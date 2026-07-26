import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { aggregateWalkingSkeletonRuns } from "./aggregate.js";
import {
  EvaluationError,
  type EvaluationErrorCode,
  type EvaluationHost,
} from "./contract.js";
import { validateCodexTransport, type CodexTransportV1 } from "./hosts.js";
import {
  runWalkingSkeleton,
  type WalkingSkeletonRunOptions,
} from "./runner.js";
import { buildForwardStructuralReport } from "../scenarios/forward.js";
import { aggregateForwardRuns } from "../forward/aggregate.js";
import { runForwardSuite, type ForwardRunOptions } from "../forward/runner.js";

export const usage = `pnpm evals:agent-pack -- --suite walking-skeleton --host <claude|codex> [--run-id <id>] [--out <dir>] [--candidate-sha <sha>] [--host-home <dir>] [--product-name <name>]
  Codex transport override: --codex-model <id> --codex-provider <name> --codex-base-url <loopback-http-url>
pnpm evals:agent-pack -- --suite walking-skeleton --aggregate --run-ids <claude-1,claude-2,codex-1,codex-2> [--suite-run-id <id>] [--out <dir>] [--candidate-sha <sha>]
pnpm evals:agent-pack -- --suite forward --structural [--candidate-sha <sha>]
pnpm evals:agent-pack -- --suite forward --host <claude|codex> --run-id <id> --candidate-sha <sha> --out <dir> [--host-home <dir>]
pnpm evals:agent-pack -- --suite forward --aggregate --run-ids <claude-1,claude-2,codex-1,codex-2> --candidate-sha <sha> [--suite-run-id <id>] [--out <dir>]`;

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
type ForwardStructuralOptions = {
  readonly mode: "forward-structural";
  readonly candidateSha: string;
};
type ForwardRunCliOptions = {
  readonly mode: "forward-run";
  readonly options: ForwardRunOptions;
};
type ForwardAggregateOptions = {
  readonly mode: "forward-aggregate";
  readonly out: string;
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly runIds: readonly string[];
  readonly suiteRunId: string;
};

export function parseCliOptions(
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
):
  | RunOptions
  | AggregateOptions
  | ForwardStructuralOptions
  | ForwardRunCliOptions
  | ForwardAggregateOptions {
  const { values, switches } = parseFlags(argv);
  const suite = values.get("--suite");
  if (suite === "forward") {
    const sourceRoot = resolve(cwd, values.get("--source") ?? ".");
    const candidateSha =
      values.get("--candidate-sha") ?? resolveHead(sourceRoot);
    const out = resolve(
      cwd,
      values.get("--out") ?? "tooling/agent-pack/evals/runs",
    );
    const transportFlagsPresent = codexTransportFlags.some((flag) =>
      values.has(flag),
    );
    if (switches.has("--structural")) {
      const allowedValues = new Set(["--suite", "--source", "--candidate-sha"]);
      const unsupported = [...values.keys()].filter(
        (key) => !allowedValues.has(key),
      );
      if (unsupported.length > 0 || switches.has("--aggregate")) {
        throw new EvaluationError(
          "EVAL_INVALID_ARGUMENT",
          "--suite forward --structural does not accept host or run options.",
        );
      }
      return { mode: "forward-structural", candidateSha };
    }
    if (switches.has("--aggregate")) {
      rejectFlagsOutsideMode(values, aggregateValueFlags, "forward aggregate");
      if (transportFlagsPresent) invalidCodexTransportUse();
      return {
        mode: "forward-aggregate",
        out,
        sourceRoot,
        candidateSha,
        runIds: required(values, "--run-ids").split(",").filter(Boolean),
        suiteRunId:
          values.get("--suite-run-id") ??
          `forward-suite-${now.toISOString().replace(/[^0-9]/gu, "")}`,
      };
    }
    const host = values.get("--host");
    if (host !== "claude" && host !== "codex") {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        "--host must be claude or codex.",
      );
    }
    if (host !== "codex" && transportFlagsPresent) invalidCodexTransportUse();
    rejectFlagsOutsideMode(values, forwardRunValueFlags, "forward run");
    const codexTransport =
      host === "codex" ? parseCodexTransport(values) : undefined;
    return {
      mode: "forward-run",
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
        ...(codexTransport ? { codexTransport } : {}),
      },
    };
  }
  if (suite !== "walking-skeleton") {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--suite must be walking-skeleton or forward.",
    );
  }
  const sourceRoot = resolve(cwd, values.get("--source") ?? ".");
  const candidateSha = values.get("--candidate-sha") ?? resolveHead(sourceRoot);
  const out = resolve(
    cwd,
    values.get("--out") ?? "tooling/agent-pack/evals/runs",
  );
  const transportFlagsPresent = codexTransportFlags.some((flag) =>
    values.has(flag),
  );
  if (switches.has("--aggregate")) {
    rejectFlagsOutsideMode(values, aggregateValueFlags, "aggregate");
    if (transportFlagsPresent) invalidCodexTransportUse();
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
  if (host !== "codex" && transportFlagsPresent) invalidCodexTransportUse();
  rejectFlagsOutsideMode(values, runValueFlags, "run");
  const codexTransport =
    host === "codex" ? parseCodexTransport(values) : undefined;
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
      ...(codexTransport ? { codexTransport } : {}),
    },
  };
}

const codexTransportFlags = [
  "--codex-model",
  "--codex-provider",
  "--codex-base-url",
] as const;
const commonValueFlags = [
  "--suite",
  "--source",
  "--out",
  "--candidate-sha",
] as const;
const aggregateValueFlags = new Set([
  ...commonValueFlags,
  "--run-ids",
  "--suite-run-id",
]);
const runValueFlags = new Set([
  ...commonValueFlags,
  "--host",
  "--run-id",
  "--host-home",
  "--product-name",
  ...codexTransportFlags,
]);
const forwardRunValueFlags = new Set([
  ...commonValueFlags,
  "--host",
  "--run-id",
  "--host-home",
  ...codexTransportFlags,
]);
const allValueFlags = new Set([...aggregateValueFlags, ...runValueFlags]);
function rejectFlagsOutsideMode(
  values: ReadonlyMap<string, string>,
  allowed: ReadonlySet<string>,
  mode: string,
): void {
  const unexpected = [...values.keys()].find((flag) => !allowed.has(flag));
  if (unexpected) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      `${unexpected} is not allowed in ${mode} mode.`,
    );
  }
}
function parseCodexTransport(
  values: ReadonlyMap<string, string>,
): CodexTransportV1 | undefined {
  const present = codexTransportFlags.filter((flag) => values.has(flag));
  if (present.length === 0) return undefined;
  if (present.length !== codexTransportFlags.length) invalidCodexTransportUse();
  return validateCodexTransport({
    model: required(values, "--codex-model"),
    provider_name: required(values, "--codex-provider"),
    base_url: required(values, "--codex-base-url"),
    wire_api: "responses",
    requires_openai_auth: true,
    supports_websockets: true,
  });
}
function invalidCodexTransportUse(): never {
  throw new EvaluationError(
    "EVAL_INVALID_ARGUMENT",
    "Codex transport requires --host codex and all three explicit transport flags.",
  );
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
        : parsed.mode === "aggregate"
          ? await aggregateWalkingSkeletonRuns(parsed)
          : parsed.mode === "forward-run"
            ? await runForwardSuite(parsed.options)
            : parsed.mode === "forward-aggregate"
              ? await aggregateForwardRuns(parsed)
              : buildForwardStructuralReport(parsed.candidateSha);
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
  const booleanFlags = new Set(["--aggregate", "--structural"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--") continue;
    if (!flag?.startsWith("--")) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Unexpected argument: ${flag ?? ""}`,
      );
    }
    if (!booleanFlags.has(flag) && !allValueFlags.has(flag)) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Unknown flag: ${flag}.`,
      );
    }
    if (booleanFlags.has(flag)) {
      if (switches.has(flag)) {
        throw new EvaluationError(
          "EVAL_INVALID_ARGUMENT",
          `Duplicate flag: ${flag}.`,
        );
      }
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
    if (values.has(flag)) {
      throw new EvaluationError(
        "EVAL_INVALID_ARGUMENT",
        `Duplicate flag: ${flag}.`,
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
    code === "EVAL_HOST_AUTH_REQUIRED" ||
    code === "EVAL_HOST_ISOLATION_UNAVAILABLE"
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
