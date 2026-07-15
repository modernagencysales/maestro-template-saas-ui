import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
  options: { readonly cwd?: string; readonly outcomePath?: string } = {},
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
  if (options.outcomePath) {
    const outputContent = readFileSync(outputPath, "utf8");
    writeFileSync(
      options.outcomePath,
      `${JSON.stringify(
        {
          kind: result.status === null ? "spawn_failed" : "exited",
          outputPath: resolve(outputPath),
          outputSha256: createHash("sha256")
            .update(outputContent)
            .digest("hex"),
          schemaVersion: "maestro-rtk-file-outcome/v1",
          status: result.status,
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
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
