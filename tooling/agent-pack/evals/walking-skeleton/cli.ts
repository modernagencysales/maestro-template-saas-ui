import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { EvaluationError, type EvaluationHost } from "./contract.js";
import { runWalkingSkeleton } from "./runner.js";

type CliOptions = {
  readonly host: EvaluationHost;
  readonly runId: string;
  readonly out: string;
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly hostHome: string;
  readonly productName: string;
};

export function parseCliOptions(
  argv: readonly string[],
  cwd: string,
): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Unexpected argument: ${flag ?? ""}`,
      );
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Missing value for ${flag}.`,
      );
    }
    values.set(flag, value);
    index += 1;
  }
  const suite = values.get("--suite");
  if (suite !== "walking-skeleton") {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--suite walking-skeleton is required.",
    );
  }
  const host = values.get("--host");
  if (host !== "claude" && host !== "codex") {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--host must be claude or codex.",
    );
  }
  const sourceRoot = resolve(cwd, values.get("--source") ?? ".");
  return {
    host,
    runId: required(values, "--run-id"),
    out: resolve(cwd, required(values, "--out")),
    sourceRoot,
    candidateSha: values.get("--candidate-sha") ?? resolveHead(sourceRoot),
    hostHome: resolve(cwd, required(values, "--host-home")),
    productName: values.get("--product-name") ?? "Acme Workspace",
  };
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  try {
    const receipt = await runWalkingSkeleton(
      parseCliOptions(argv, process.cwd()),
    );
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    const classified =
      error instanceof EvaluationError
        ? error
        : new EvaluationError(
            "EVAL_HOST_EXECUTION_FAILED",
            "Walking-skeleton evaluation failed unexpectedly.",
          );
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: classified.code, message: classified.message })}\n`,
    );
    process.exitCode = exitCode(classified.code);
  }
}

function resolveHead(sourceRoot: string): string {
  try {
    return execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "Could not resolve --candidate-sha from the source repository.",
    );
  }
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) {
    throw new EvaluationError("EVAL_INVALID_ARGUMENT", `${key} is required.`);
  }
  return value;
}

function exitCode(code: EvaluationError["code"]): number {
  switch (code) {
    case "EVAL_INVALID_ARGUMENT":
    case "EVAL_OUTPUT_EXISTS":
      return 2;
    case "EVAL_HOST_EXECUTABLE_UNAVAILABLE":
    case "EVAL_HOST_AUTH_REQUIRED":
      return 3;
    case "EVAL_HOST_EXECUTION_FAILED":
    case "EVAL_RESULT_MISSING":
    case "EVAL_RESULT_INVALID":
      return 4;
    case "EVAL_ASSERTION_FAILED":
      return 5;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (isDirectRun) {
  await main();
}
