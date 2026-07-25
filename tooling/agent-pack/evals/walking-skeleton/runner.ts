import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildWalkingSkeletonPrompt,
  EvaluationError,
  gradeWalkingSkeleton,
  parseWalkingSkeletonResult,
  redactJson,
  redactText,
  type EvaluationHost,
  type WalkingSkeletonVerdict,
} from "./contract.js";
import { createHostAdapter, type WalkingSkeletonHostAdapter } from "./hosts.js";

const execFileAsync = promisify(execFile);

export type WalkingSkeletonRunOptions = {
  readonly host: EvaluationHost;
  readonly runId: string;
  readonly out: string;
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly hostHome: string;
  readonly productName: string;
  readonly timeoutMs?: number;
};

export type WalkingSkeletonRunReceipt = {
  readonly schemaVersion: 1;
  readonly suite: "walking-skeleton";
  readonly host: EvaluationHost;
  readonly runId: string;
  readonly candidateSha: string;
  readonly status: "passed" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outputDirectory: string;
  readonly errorCode?: string;
  readonly verdict?: WalkingSkeletonVerdict;
};

export type WalkingSkeletonRunPorts = {
  readonly now: () => Date;
  readonly adapter: WalkingSkeletonHostAdapter;
  readonly prepareWorkspace: (input: {
    readonly sourceRoot: string;
    readonly candidateSha: string;
    readonly workspace: string;
  }) => Promise<void>;
};

export async function runWalkingSkeleton(
  options: WalkingSkeletonRunOptions,
  overrides: Partial<WalkingSkeletonRunPorts> = {},
): Promise<WalkingSkeletonRunReceipt> {
  validateOptions(options);
  const now = overrides.now ?? (() => new Date());
  const adapter = overrides.adapter ?? createHostAdapter(options.host);
  const prepareWorkspace = overrides.prepareWorkspace ?? cloneCandidate;
  const outputBase = resolve(options.out);
  const outputDirectory = join(outputBase, options.runId);
  await mkdir(outputBase, { recursive: true });
  try {
    await mkdir(outputDirectory);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new EvaluationError(
        "EVAL_OUTPUT_EXISTS",
        `Run output already exists: ${outputDirectory}`,
      );
    }
    throw error;
  }

  const startedAt = now().toISOString();
  const workspace = join(outputDirectory, "workspace");
  const resultPath = ".maestro-eval/walking-skeleton-result.json";
  await writeJson(join(outputDirectory, "metadata.json"), {
    schemaVersion: 1,
    suite: "walking-skeleton",
    host: options.host,
    runId: options.runId,
    candidateSha: options.candidateSha,
    startedAt,
  });
  await writeRetention(outputDirectory, startedAt);

  try {
    await adapter.preflight({
      cwd: options.sourceRoot,
      hostHome: options.hostHome,
    });
    await prepareWorkspace({
      sourceRoot: options.sourceRoot,
      candidateSha: options.candidateSha,
      workspace,
    });
    const prompt = buildWalkingSkeletonPrompt({
      candidateSha: options.candidateSha,
      productName: options.productName,
      resultPath,
    });
    const hostResult = await adapter.run({
      cwd: workspace,
      hostHome: options.hostHome,
      prompt,
      timeoutMs: options.timeoutMs ?? 45 * 60 * 1000,
    });
    await writeFile(
      join(outputDirectory, "host.stdout.log"),
      redactText(hostResult.stdout),
      "utf8",
    );
    await writeFile(
      join(outputDirectory, "host.stderr.log"),
      redactText(hostResult.stderr),
      "utf8",
    );
    if (hostResult.exitCode !== 0) {
      throw new EvaluationError(
        "EVAL_HOST_EXECUTION_FAILED",
        `${options.host} exited without completing the scenario.`,
      );
    }

    let rawResult: unknown;
    try {
      rawResult = JSON.parse(
        await readFile(join(workspace, resultPath), "utf8"),
      );
    } catch {
      throw new EvaluationError(
        "EVAL_RESULT_MISSING",
        "The host did not write the required walking-skeleton result.",
      );
    }
    const result = parseWalkingSkeletonResult(rawResult);
    await writeJson(join(workspace, resultPath), redactJson(result));
    const verdict = await gradeWalkingSkeleton({
      result,
      workspace,
      candidateSha: options.candidateSha,
      startedAt,
    });
    await writeJson(
      join(outputDirectory, "result.redacted.json"),
      redactJson(result),
    );
    await writeJson(join(outputDirectory, "verdict.json"), verdict);
    if (verdict.status !== "passed") {
      throw new EvaluationError(
        "EVAL_ASSERTION_FAILED",
        `Walking-skeleton grading failed with ${String(verdict.failures.length)} assertion(s).`,
      );
    }
    const receipt: WalkingSkeletonRunReceipt = {
      schemaVersion: 1,
      suite: "walking-skeleton",
      host: options.host,
      runId: options.runId,
      candidateSha: options.candidateSha,
      status: "passed",
      startedAt,
      completedAt: now().toISOString(),
      outputDirectory,
      verdict,
    };
    await writeJson(join(outputDirectory, "receipt.json"), receipt);
    return receipt;
  } catch (error) {
    const classified =
      error instanceof EvaluationError
        ? error
        : new EvaluationError(
            "EVAL_HOST_EXECUTION_FAILED",
            "Walking-skeleton execution failed unexpectedly.",
          );
    const receipt: WalkingSkeletonRunReceipt = {
      schemaVersion: 1,
      suite: "walking-skeleton",
      host: options.host,
      runId: options.runId,
      candidateSha: options.candidateSha,
      status: "failed",
      startedAt,
      completedAt: now().toISOString(),
      outputDirectory,
      errorCode: classified.code,
    };
    await writeJson(join(outputDirectory, "receipt.json"), receipt);
    throw classified;
  }
}

export async function cloneCandidate(input: {
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly workspace: string;
}): Promise<void> {
  const sourceRoot = await realpath(input.sourceRoot);
  await execFileAsync(
    "git",
    ["clone", "--no-local", "--no-checkout", sourceRoot, input.workspace],
    { maxBuffer: 5 * 1024 * 1024 },
  );
  await execFileAsync(
    "git",
    ["-C", input.workspace, "checkout", "--detach", input.candidateSha],
    { maxBuffer: 5 * 1024 * 1024 },
  );
  const { stdout } = await execFileAsync(
    "git",
    ["-C", input.workspace, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  );
  if (String(stdout).trim() !== input.candidateSha) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "The clean clone did not resolve to the pinned candidate SHA.",
    );
  }
}

function validateOptions(options: WalkingSkeletonRunOptions): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(options.runId)) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--run-id must be 1-64 safe filename characters.",
    );
  }
  if (!/^[0-9a-f]{40}$/u.test(options.candidateSha)) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--candidate-sha must be a full 40-character commit SHA.",
    );
  }
  if (!isAbsolute(options.hostHome)) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--host-home must be an absolute, isolated host state directory.",
    );
  }
  if (options.productName.trim().length === 0) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--product-name is required.",
    );
  }
}

async function writeRetention(
  directory: string,
  startedAt: string,
): Promise<void> {
  const deleteAfter = new Date(
    Date.parse(startedAt) + 14 * 24 * 60 * 60 * 1000,
  );
  await writeJson(join(directory, "retention.json"), {
    schemaVersion: 1,
    containsSyntheticRedactedEvidenceOnly: true,
    passedRunDays: 14,
    failedRunMaximumDays: 30,
    deleteAfter: deleteAfter.toISOString(),
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
