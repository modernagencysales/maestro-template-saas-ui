import { spawnSync } from "node:child_process";
import { closeSync, openSync, readFileSync } from "node:fs";

export const runRtk = (
  args: readonly string[],
  options: { readonly cwd?: string; readonly quiet?: boolean } = {},
): string => {
  const result = spawnSync("rtk", [...args], {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0)
    throw new Error(
      `rtk ${args.join(" ")} failed (${result.status ?? "unknown"})`,
    );
  return result.stdout.trim();
};

export const runRtkToFile = (
  args: readonly string[],
  outputPath: string,
  options: { readonly cwd?: string } = {},
): string => {
  const output = openSync(outputPath, "wx");
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync("rtk", [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", output, "inherit"],
    });
  } finally {
    closeSync(output);
  }
  if (result.status !== 0)
    throw new Error(
      `rtk ${args.join(" ")} failed (${result.status ?? "unknown"})`,
    );
  return readFileSync(outputPath, "utf8").trim();
};

export const gitBranchExists = (branch: string, cwd = process.cwd()): boolean =>
  runRtk(["proxy", "git", "branch", "--list", branch], {
    cwd,
    quiet: true,
  }).length > 0;

export const gitIsAncestor = (
  ancestor: string,
  descendant: string,
  cwd = process.cwd(),
): boolean => {
  const result = spawnSync(
    "rtk",
    ["git", "merge-base", "--is-ancestor", ancestor, descendant],
    { cwd, stdio: "ignore" },
  );
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(
    `rtk git merge-base --is-ancestor ${ancestor} ${descendant} failed ` +
      `(${result.status ?? "unknown"})`,
  );
};
