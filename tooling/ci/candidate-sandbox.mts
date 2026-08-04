import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function candidateEnvironment(
  proxyUrl = process.env.DEPENDENCY_PROXY_URL ?? "http://127.0.0.1:4873",
): Readonly<Record<string, string>> {
  return {
    CI: "true",
    HOME: "/tmp/candidate-home",
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
    "bwrap",
    "--die-with-parent",
    "--new-session",
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
    "--tmpfs",
    "/tmp",
    "--dir",
    "/tmp/candidate-home",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--rlimit-as",
    "1073741824",
    "--rlimit-cpu",
    "300",
    "--rlimit-nofile",
    "1024",
    "--chdir",
    "/candidate",
  ];
}

export function assertCandidateDependencyProxyIsWired(
  wired = process.env.DEPENDENCY_PROXY_WIRED === "1",
): void {
  if (!wired)
    throw new Error(
      "candidate install requires a controller-local dependency proxy wired into its network namespace",
    );
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

function main(): void {
  if (process.argv[2] !== "install") return;
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
  const command = [
    "env",
    "-i",
    ...Object.entries(candidateEnvironment()).map(([k, v]) => `${k}=${v}`),
    "pnpm",
    "fetch",
    "--frozen-lockfile",
    "--ignore-scripts",
  ];
  const result = spawnSync(executable, [...sandboxArgs, "--", ...command], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  const install = spawnSync(
    executable,
    [
      ...sandboxArgs,
      "--",
      "env",
      "-i",
      ...Object.entries(candidateEnvironment()).map(([k, v]) => `${k}=${v}`),
      "pnpm",
      "install",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ],
    { stdio: "inherit" },
  );
  if (install.status !== 0) process.exit(install.status ?? 1);
}

main();
