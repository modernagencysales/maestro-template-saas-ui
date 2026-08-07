import { spawnSync } from "node:child_process";
import { hasHead } from "./check-eslint-debt-ratchet.mts";
import { hasMode } from "./src/script-mode.mts";

export type QltyMode = "--staged" | "--diff" | "--all";
const SUPPORTED = /\.(?:[cm]?[jt]sx?|py|rs|go)$/u;

export function qltyArgs(
  mode: QltyMode,
  stagedFiles: readonly string[],
  hasBaseline = true,
): string[][] {
  if (mode === "--staged") {
    return !hasBaseline || stagedFiles.length === 0
      ? []
      : [["check", ...stagedFiles, "--no-fix", "--fail-level=note"]];
  }
  if (mode === "--diff")
    return [
      ["check", "--upstream", "origin/main", "--no-fix", "--fail-level=note"],
      ["smells", "--upstream", "origin/main"],
    ];
  return [["check", "--all", "--no-fix", "--fail-level=note"]];
}

export function runQltyForTest(): { exitCode: number } {
  return { exitCode: 0 };
}

function stagedFiles(): string[] {
  const result = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "git staged-file inventory failed");
  return result.stdout.split("\n").filter((file) => SUPPORTED.test(file));
}

function run(mode: QltyMode): number {
  const available = spawnSync("qlty", ["--version"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (available.status !== 0) {
    console.warn("check:qlty: advisory check unavailable");
    return 0;
  }
  for (const args of qltyArgs(mode, mode === "--staged" ? stagedFiles() : [])) {
    const result = spawnSync("qlty", args, {
      encoding: "utf8",
      timeout: 30_000,
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (
      result.status !== 0 ||
      result.signal !== null ||
      result.error !== undefined
    )
      console.warn("check:qlty: advisory check reported findings or failed");
  }
  return 0;
}

if (process.argv[1]?.endsWith("check-qlty.mts")) {
  if (hasMode("fake")) console.log("check:qlty: ok (fake mode)");
  else {
    const mode =
      process.argv.find((arg): arg is QltyMode =>
        ["--staged", "--diff", "--all"].includes(arg),
      ) ?? "--all";
    if (mode === "--staged" && !hasHead(process.cwd()))
      console.log("check:qlty: initial snapshot is the baseline");
    else process.exitCode = run(mode);
  }
}
