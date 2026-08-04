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
  const network =
    process.env.DEPENDENCY_PROXY_NETWORK_MODE === "shared-proxy"
      ? ["--share-net"]
      : ["--unshare-net"];
  return [
    "bwrap",
    "--die-with-parent",
    "--new-session",
    "--unshare-user",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--unshare-cgroup",
    ...network,
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
  input: {
    readonly wired?: boolean;
    readonly networkMode?: string;
    readonly egressPolicyDigest?: string;
  } = {},
): void {
  const wired = input.wired ?? process.env.DEPENDENCY_PROXY_WIRED === "1";
  const networkMode =
    input.networkMode ?? process.env.DEPENDENCY_PROXY_NETWORK_MODE;
  const policyDigest =
    input.egressPolicyDigest ??
    process.env.DEPENDENCY_PROXY_EGRESS_POLICY_SHA256;
  if (
    !wired ||
    networkMode !== "shared-proxy" ||
    !/^sha256:[a-f0-9]{64}$/u.test(policyDigest ?? "")
  )
    throw new Error(
      "candidate install requires a controller-local dependency proxy and attested egress policy",
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

function validateWorkspace(workspace: string): void {
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
}

async function installCandidate(workspace: string): Promise<void> {
  if (process.platform !== "linux")
    throw new Error("candidate sandbox requires Linux Bubblewrap");
  assertCandidateDependencyProxyIsWired();
  const proxyUrl = process.env.DEPENDENCY_PROXY_URL ?? "http://127.0.0.1:4873";
  const health = await fetch(new URL("/health", proxyUrl), {
    signal: AbortSignal.timeout(2_000),
  }).catch(() => undefined);
  if (!health?.ok)
    throw new Error("controller dependency proxy health check failed");
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

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "install" && mode !== "validate") return;
  const workspace = process.cwd();
  validateWorkspace(workspace);
  if (mode === "install") await installCandidate(workspace);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
