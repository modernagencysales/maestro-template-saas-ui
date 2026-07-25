import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { aggregateWalkingSkeletonRuns } from "./aggregate.js";
import {
  EvaluationError,
  type EvaluationErrorCode,
  type EvaluationHost,
} from "./contract.js";
import {
  runWalkingSkeleton,
  type WalkingSkeletonRunOptions,
} from "./runner.js";

export const usage = `pnpm evals:agent-pack -- --suite walking-skeleton --host <claude|codex> [--run-id <id>] [--out <dir>] [--candidate-sha <sha>] [--host-home <dir>] [--product-name <name>]
pnpm evals:agent-pack -- --suite walking-skeleton --aggregate --run-ids <claude-1,claude-2,codex-1,codex-2> [--suite-run-id <id>] [--out <dir>] [--candidate-sha <sha>]`;

type AggregateOptions = {
  readonly mode: "aggregate";
  readonly out: string;
  readonly candidateSha: string;
  readonly runIds: readonly string[];
  readonly suiteRunId: string;
};
type RunOptions = {
  readonly mode: "run";
  readonly options: WalkingSkeletonRunOptions;
};

export function parseCliOptions(
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): RunOptions | AggregateOptions {
  const { values, switches } = parseFlags(argv);
  if (values.get("--suite") !== "walking-skeleton") {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--suite walking-skeleton is required.",
    );
  }
  const sourceRoot = resolve(cwd, values.get("--source") ?? ".");
  const out = resolve(
    cwd,
    values.get("--out") ?? "tooling/agent-pack/evals/runs",
  );
  const candidateSha = values.get("--candidate-sha") ?? resolveHead(sourceRoot);
  if (switches.has("--aggregate")) {
    const runIds = required(values, "--run-ids").split(",").filter(Boolean);
    return {
      mode: "aggregate",
      out,
      candidateSha,
      runIds,
      suiteRunId:
        values.get("--suite-run-id") ??
        `suite-${now.toISOString().replace(/[^0-9]/gu, "")}`,
    };
  }
  const host = values.get("--host");
  if (host !== "claude" && host !== "codex") {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--host must be claude or codex.",
    );
  }
  return {
    mode: "run",
    options: {
      host,
      runId:
        values.get("--run-id") ??
        `${host}-${now.toISOString().replace(/[^0-9]/gu, "")}-${String(process.pid)}`,
      out,
      sourceRoot,
      candidateSha,
      hostHome: resolve(
        values.get("--host-home") ?? defaultHostHome(host, env),
      ),
      productName: values.get("--product-name") ?? "Acme Workspace",
    },
  };
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  if (argv.includes("--help")) {
    process.stdout.write(`${usage}\n`);
    return;
  }
  try {
    const parsed = parseCliOptions(argv, process.cwd());
    const result =
      parsed.mode === "run"
        ? await runWalkingSkeleton(parsed.options)
        : await aggregateWalkingSkeletonRuns(parsed);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const classified =
      error instanceof EvaluationError
        ? error
        : new EvaluationError(
            "EVAL_HOST_EXECUTION_FAILED",
            "Evaluation failed unexpectedly.",
          );
    process.stderr.write(
      `${JSON.stringify({ status: "failed", code: classified.code, message: classified.message })}\n`,
    );
    process.exitCode = exitCode(classified.code);
  }
}

function parseFlags(argv: readonly string[]): {
  readonly values: ReadonlyMap<string, string>;
  readonly switches: ReadonlySet<string>;
} {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const booleanFlags = new Set(["--aggregate"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Unexpected argument: ${flag ?? ""}`,
      );
    }
    if (booleanFlags.has(flag)) {
      switches.add(flag);
      continue;
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
  return { values, switches };
}

function defaultHostHome(host: EvaluationHost, env: NodeJS.ProcessEnv): string {
  return host === "codex"
    ? (env.CODEX_HOME ?? join(homedir(), ".codex"))
    : (env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"));
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
      "Could not resolve candidate HEAD.",
    );
  }
}

function required(values: ReadonlyMap<string, string>, key: string): string {
  const value = values.get(key);
  if (!value)
    throw new EvaluationError("EVAL_INVALID_ARGUMENT", `${key} is required.`);
  return value;
}

function exitCode(code: EvaluationErrorCode): number {
  if (code === "EVAL_INVALID_ARGUMENT" || code === "EVAL_OUTPUT_EXISTS")
    return 2;
  if (
    code === "EVAL_HOST_EXECUTABLE_UNAVAILABLE" ||
    code === "EVAL_HOST_AUTH_REQUIRED"
  )
    return 3;
  if (code === "EVAL_SUITE_INCOMPLETE" || code === "EVAL_SUITE_DIVERGED")
    return 6;
  return code === "EVAL_ASSERTION_FAILED" ? 5 : 4;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
if (isDirectRun) await main();
