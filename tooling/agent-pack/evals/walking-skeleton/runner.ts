import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildWalkingSkeletonPrompt,
  EvaluationError,
  gradeHostReport,
  parseWalkingSkeletonResult,
  redactJson,
  redactText,
  type CanonicalEvidenceHashes,
  type EvaluationHost,
  type WalkingSkeletonVerdict,
} from "./contract.js";
import {
  claudeSandboxSettings,
  createHostAdapter,
  type CodexTransportV1,
  type WalkingSkeletonHostAdapter,
} from "./hosts.js";
import {
  safeVerifierEnvironment,
  verifyExecutableEvidence,
  type ExecutableEvidencePorts,
} from "./verifier.js";

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
  readonly codexTransport?: CodexTransportV1;
};
export type WalkingSkeletonRunReceipt = {
  readonly schemaVersion: 2;
  readonly suite: "walking-skeleton";
  readonly host: EvaluationHost;
  readonly runId: string;
  readonly candidateSha: string;
  readonly status: "passed" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outputDirectory: string;
  readonly workspaceRetained: false;
  readonly errorCode?: string;
  readonly verdict?: WalkingSkeletonVerdict;
  readonly canonicalHashes?: CanonicalEvidenceHashes;
};
export type WalkingSkeletonRunPorts = {
  readonly now: () => Date;
  readonly adapter: WalkingSkeletonHostAdapter;
  readonly prepareWorkspace: (input: {
    readonly sourceRoot: string;
    readonly candidateSha: string;
    readonly workspace: string;
    readonly sessionDir: string;
  }) => Promise<void>;
  readonly verifierPorts: Partial<ExecutableEvidencePorts>;
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
  const sessionDir = await mkdtemp(join(tmpdir(), "maestro-walking-"));
  const resultPath = ".maestro-eval/walking-skeleton-result.json";
  await writeFile(
    join(sessionDir, "empty-mcp.json"),
    '{"mcpServers":{}}\n',
    "utf8",
  );
  await writeFile(
    join(sessionDir, "claude-settings.json"),
    claudeSandboxSettings(options.hostHome),
    "utf8",
  );
  await writeJson(join(outputDirectory, "metadata.json"), {
    schemaVersion: 2,
    suite: "walking-skeleton",
    host: options.host,
    runId: options.runId,
    candidateSha: options.candidateSha,
    startedAt,
    environmentPolicy: "strict-allowlist",
    hostSessionPolicy: options.host === "codex" ? "ephemeral" : "isolated-temp",
  });
  await writeRetention(outputDirectory, startedAt);

  try {
    await adapter.preflight({
      cwd: options.sourceRoot,
      hostHome: options.hostHome,
      sessionDir,
    });
    await prepareWorkspace({
      sourceRoot: options.sourceRoot,
      candidateSha: options.candidateSha,
      workspace,
      sessionDir,
    });
    const hostResult = await adapter.run({
      cwd: workspace,
      hostHome: options.hostHome,
      sessionDir,
      prompt: buildWalkingSkeletonPrompt({
        candidateSha: options.candidateSha,
        productName: options.productName,
        resultPath,
      }),
      timeoutMs: options.timeoutMs ?? 45 * 60 * 1000,
      ...(options.codexTransport
        ? { codexTransport: options.codexTransport }
        : {}),
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
        "The host did not write the required result.",
      );
    }
    const result = parseWalkingSkeletonResult(rawResult);
    const executableEvidence = await verifyExecutableEvidence({
      workspace,
      candidateSha: options.candidateSha,
      expectedProductName: options.productName,
      sessionDir,
      result,
      ...(overrides.verifierPorts ? { ports: overrides.verifierPorts } : {}),
    });
    const verdict = gradeHostReport({
      result,
      candidateSha: options.candidateSha,
      startedAt,
      executableEvidence,
    });
    await writeJson(
      join(outputDirectory, "result.redacted.json"),
      redactJson(result),
    );
    await writeJson(
      join(outputDirectory, "evidence-summary.json"),
      executableEvidence,
    );
    await writeJson(join(outputDirectory, "verdict.json"), verdict);
    if (verdict.status !== "passed") {
      throw new EvaluationError(
        "EVAL_ASSERTION_FAILED",
        `Walking-skeleton grading failed with ${String(verdict.failures.length)} assertion(s).`,
      );
    }
    const receipt: WalkingSkeletonRunReceipt = {
      schemaVersion: 2,
      suite: "walking-skeleton",
      host: options.host,
      runId: options.runId,
      candidateSha: options.candidateSha,
      status: "passed",
      startedAt,
      completedAt: now().toISOString(),
      outputDirectory,
      workspaceRetained: false,
      verdict,
      canonicalHashes: executableEvidence.canonicalHashes,
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
      schemaVersion: 2,
      suite: "walking-skeleton",
      host: options.host,
      runId: options.runId,
      candidateSha: options.candidateSha,
      status: "failed",
      startedAt,
      completedAt: now().toISOString(),
      outputDirectory,
      workspaceRetained: false,
      errorCode: classified.code,
    };
    await writeJson(join(outputDirectory, "receipt.json"), receipt);
    throw classified;
  } finally {
    await rm(workspace, { recursive: true, force: true });
    await rm(sessionDir, { recursive: true, force: true });
  }
}

export async function cloneCandidate(input: {
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly workspace: string;
  readonly sessionDir: string;
}): Promise<void> {
  const sourceRoot = await realpath(input.sourceRoot);
  const env = safeVerifierEnvironment(input.sessionDir);
  await execFileAsync(
    "git",
    ["clone", "--no-local", "--no-checkout", sourceRoot, input.workspace],
    { maxBuffer: 5 * 1024 * 1024, env },
  );
  await execFileAsync(
    "git",
    ["-C", input.workspace, "checkout", "--detach", input.candidateSha],
    { maxBuffer: 5 * 1024 * 1024, env },
  );
  const { stdout } = await execFileAsync(
    "git",
    ["-C", input.workspace, "rev-parse", "HEAD"],
    { encoding: "utf8", env },
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
      "--candidate-sha must be a full commit SHA.",
    );
  }
  if (!isAbsolute(options.hostHome)) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "--host-home must be absolute when supplied.",
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
    schemaVersion: 2,
    retainedArtifacts: [
      "redacted host logs",
      "redacted host result",
      "canonical evidence hashes",
      "verdict",
      "receipt",
    ],
    workspaceRetained: false,
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
