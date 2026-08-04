import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function candidateEnvironment(
  proxy: string,
): Readonly<Record<string, string>> {
  return {
    CI: "true",
    HOME: "/tmp/candidate-home",
    npm_config_registry: proxy,
  };
}

export function candidateSandboxArgv(input: {
  readonly workspace: string;
}): readonly string[] {
  return [
    "bwrap",
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--unshare-net",
    "--ro-bind",
    input.workspace,
    "/candidate",
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
  const prefix = candidateSandboxArgv({ workspace });
  const [executable, ...sandboxArgs] = prefix;
  if (!executable) throw new Error("candidate sandbox command is empty");
  const proxy =
    process.env.DEPENDENCY_PROXY_URL ?? "http://dependency-proxy:4873";
  const command = [
    "env",
    "-i",
    ...Object.entries(candidateEnvironment(proxy)).map(([k, v]) => `${k}=${v}`),
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
      ...Object.entries(candidateEnvironment(proxy)).map(
        ([k, v]) => `${k}=${v}`,
      ),
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
