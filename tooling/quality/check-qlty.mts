import { spawnSync } from "node:child_process";
import { hasMode } from "./src/script-mode.mts";

export type QltyMode = "--staged" | "--diff" | "--all";
const SUPPORTED = /\.(?:[cm]?[jt]sx?|py|rs|go)$/u;

type QltyProcessResult = {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
};

type QltyAdvisoryContext = "availability" | "check";

type QltyAdvisory = {
  readonly exitCode: 0;
  readonly warning?: string;
};

export function qltyArgs(
  mode: QltyMode,
  stagedFiles: readonly string[],
): string[][] {
  if (mode === "--staged") {
    return stagedFiles.length === 0
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

export function qltyAdvisory(
  result: QltyProcessResult,
  context: QltyAdvisoryContext,
): QltyAdvisory {
  if (
    result.status === 0 &&
    result.signal === null &&
    result.error === undefined
  ) {
    return { exitCode: 0 };
  }
  const details = [
    result.status === null ? undefined : `status ${result.status}`,
    result.signal === null ? undefined : `signal ${result.signal}`,
    errorDetail(result.error),
  ].filter((detail): detail is string => detail !== undefined);
  const message =
    context === "availability"
      ? "qlty binary unavailable; advisory check skipped"
      : "advisory check reported findings or failed";
  return {
    exitCode: 0,
    warning: `check:qlty: ${message} (${details.join(", ")})`,
  };
}

function errorDetail(error: Error | undefined): string | undefined {
  if (error === undefined) return undefined;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  return code === undefined ? error.message : `${code}: ${error.message}`;
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
  const availability = qltyAdvisory(available, "availability");
  if (availability.warning !== undefined) {
    console.warn(availability.warning);
    return availability.exitCode;
  }
  try {
    for (const args of qltyArgs(
      mode,
      mode === "--staged" ? stagedFiles() : [],
    )) {
      const result = spawnSync("qlty", args, {
        encoding: "utf8",
        timeout: 30_000,
      });
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      const advisory = qltyAdvisory(result, "check");
      if (advisory.warning !== undefined) console.warn(advisory.warning);
    }
  } catch (error) {
    const advisory = qltyAdvisory(
      {
        status: null,
        signal: null,
        error: error instanceof Error ? error : new Error(String(error)),
      },
      "check",
    );
    console.warn(advisory.warning);
    return advisory.exitCode;
  }
  return 0;
}

if (process.argv[1]?.endsWith("check-qlty.mts")) {
  if (hasMode("fake")) console.log("check:qlty: ok (fake mode)");
  else
    process.exitCode = run(
      process.argv.find((arg): arg is QltyMode =>
        ["--staged", "--diff", "--all"].includes(arg),
      ) ?? "--all",
    );
}
