import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function candidateEnvironment(
  proxyUrl = process.env.DEPENDENCY_PROXY_URL ?? "http://127.0.0.1:4873",
): Readonly<Record<string, string>> {
  return {
    CI: "true",
    HOME: "/tmp/candidate-home",
    NODE_OPTIONS: "--max-old-space-size=768",
    npm_config_registry: proxyUrl,
  };
}

export function candidateSandboxArgv(input: {
  readonly workspace: string;
  readonly sourceWorkspace?: string;
  readonly runtime?: string;
}): readonly string[] {
  const sourceWorkspace = input.sourceWorkspace ?? input.workspace;
  const runtime = input.runtime ?? "/controller/runtime";
  return [
    "/usr/bin/prlimit",
    "--cpu=300",
    "--nofile=1024",
    "--",
    "bwrap",
    "--die-with-parent",
    "--new-session",
    "--clearenv",
    ...Object.entries(candidateEnvironment()).flatMap(([name, value]) => [
      "--setenv",
      name,
      value,
    ]),
    "--unshare-user",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--unshare-cgroup",
    "--unshare-net",
    "--ro-bind",
    sourceWorkspace,
    "/source",
    "--bind",
    input.workspace,
    "/candidate",
    "--ro-bind",
    runtime,
    "/runtime",
    "--ro-bind",
    `${runtime}/lib`,
    "/lib",
    "--ro-bind",
    `${runtime}/lib64`,
    "/lib64",
    "--ro-bind",
    `${runtime}/usr/lib`,
    "/usr/lib",
    "--ro-bind",
    "/controller/proxy",
    "/proxy",
    "--tmpfs",
    "/tmp",
    "--dir",
    "/tmp/candidate-home",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--chdir",
    "/candidate",
  ];
}

export function assertCandidateDependencyProxyIsWired(
  input: {
    readonly socketExists?: boolean;
    readonly socketIsSocket?: boolean;
  } = {},
): void {
  const path = "/controller/proxy/dependency.sock";
  const socketExists = input.socketExists ?? existsSync(path);
  const socketIsSocket =
    input.socketIsSocket ?? (socketExists && statSync(path).isSocket());
  if (!socketExists || !socketIsSocket)
    throw new Error(
      "candidate install requires the fixed controller dependency-proxy Unix socket",
    );
}

export function candidateInstallCommand(
  action: "fetch" | "install" | "canary",
): readonly string[] {
  return ["/runtime/bin/node", "/runtime/sandbox-runner.mjs", action];
}

export function candidateInstallSequence(
  action: "install" | "canary" = "install",
): readonly (readonly string[])[] {
  return [candidateInstallCommand(action)];
}

export function validateCandidateLockfile(input: {
  readonly lockfile: string;
  readonly allowedPackages: ReadonlySet<string>;
  readonly hasPnpmfile: boolean;
}): void {
  if (input.hasPnpmfile)
    throw new Error("candidate .pnpmfile.cjs is forbidden");
  for (const match of input.lockfile.matchAll(
    /^ {2}['"]?([^'"\s][^:'"]*)['"]?:$/gmu,
  )) {
    const key = match[1]?.replace(/\(.+$/u, "");
    if (key?.includes("@") && !input.allowedPackages.has(key)) {
      throw new Error(`candidate lockfile package ${key} is not protected`);
    }
  }
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (action !== "install" && action !== "canary") return;
  const workspace = process.cwd();
  const allowlist = JSON.parse(
    readFileSync(
      new URL("./dependency-allowlist.json", import.meta.url),
      "utf8",
    ),
  ) as {
    artifacts: Array<{ package: string }>;
  };
  validateCandidateLockfile({
    lockfile: readFileSync(`${workspace}/pnpm-lock.yaml`, "utf8"),
    allowedPackages: new Set(allowlist.artifacts.map((entry) => entry.package)),
    hasPnpmfile: existsSync(`${workspace}/.pnpmfile.cjs`),
  });
  if (process.platform !== "linux")
    throw new Error("candidate sandbox requires Linux Bubblewrap");
  assertCandidateDependencyProxyIsWired();
  const prefix = candidateSandboxArgv({ workspace });
  const [executable, ...sandboxArgs] = prefix;
  if (!executable) throw new Error("candidate sandbox command is empty");
  for (const command of candidateInstallSequence(action)) {
    const result = spawnSync(executable, [...sandboxArgs, "--", ...command], {
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
