import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  parseForwardRunEvidence,
  type ForwardHost,
  type ForwardRunEvidence,
} from "../scenarios/evidence.js";
import { forwardScenarioIds } from "../scenarios/forward.js";
import {
  EvaluationError,
  redactJson,
  redactText,
} from "../walking-skeleton/contract.js";
import {
  claudeSandboxSettings,
  createHostAdapter,
  type CodexTransportV1,
  type WalkingSkeletonHostAdapter,
} from "../walking-skeleton/hosts.js";
import { cloneCandidate } from "../walking-skeleton/runner.js";
import {
  buildForwardPrompt,
  forwardInitialContextSha256,
  gradeForwardEvidence,
  sha256,
  type ForwardScenarioVerdict,
} from "./contract.js";
import {
  forwardScenarioContracts,
  verifyForwardScenario,
  type ForwardVerifierPorts,
} from "./verifier.js";
import {
  assertDisposableReleaseTag,
  provisionDisposableReleaseTag,
} from "./disposableReleaseTag.js";

export type ForwardRunOptions = {
  readonly host: ForwardHost;
  readonly runId: string;
  readonly out: string;
  readonly sourceRoot: string;
  readonly candidateSha: string;
  readonly hostHome: string;
  readonly timeoutMs?: number;
  readonly codexTransport?: CodexTransportV1;
};

export type ForwardRunReceipt = {
  readonly schemaVersion: 1;
  readonly suite: "forward";
  readonly host: ForwardHost;
  readonly runId: string;
  readonly candidateSha: string;
  readonly status: "passed" | "failed" | "blocked-external";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outputDirectory: string;
  readonly workspaceRetained: false;
  readonly evidence: readonly ForwardRunEvidence[];
  readonly verdicts: readonly ForwardScenarioVerdict[];
  readonly errorCode?: string;
};

export type ForwardRunPorts = {
  readonly now: () => Date;
  readonly adapter: WalkingSkeletonHostAdapter;
  readonly prepareWorkspace: typeof cloneCandidate;
  readonly provisionReleaseTag: typeof provisionDisposableReleaseTag;
  readonly assertReleaseTag: typeof assertDisposableReleaseTag;
  readonly verifierPorts: Partial<ForwardVerifierPorts>;
};

export async function runForwardSuite(
  options: ForwardRunOptions,
  overrides: Partial<ForwardRunPorts> = {},
): Promise<ForwardRunReceipt> {
  validateOptions(options);
  const now = overrides.now ?? (() => new Date());
  const adapter = overrides.adapter ?? createHostAdapter(options.host);
  const prepareWorkspace = overrides.prepareWorkspace ?? cloneCandidate;
  const provisionReleaseTag =
    overrides.provisionReleaseTag ?? provisionDisposableReleaseTag;
  const assertReleaseTag =
    overrides.assertReleaseTag ?? assertDisposableReleaseTag;
  const outputBase = resolve(options.out);
  const outputDirectory = join(outputBase, options.runId);
  await mkdir(outputBase, { recursive: true });
  try {
    await mkdir(outputDirectory);
  } catch {
    throw new EvaluationError(
      "EVAL_OUTPUT_EXISTS",
      `Run output already exists: ${outputDirectory}`,
    );
  }
  const startedAt = now().toISOString();
  const sessionDir = await mkdtemp(join(tmpdir(), "maestro-forward-"));
  const evidence: ForwardRunEvidence[] = [];
  const verdicts: ForwardScenarioVerdict[] = [];
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
    schemaVersion: 1,
    suite: "forward",
    host: options.host,
    runId: options.runId,
    candidateSha: options.candidateSha,
    startedAt,
    scenarioIds: forwardScenarioIds,
    environmentPolicy: "strict-allowlist",
  });
  await writeRetention(outputDirectory, startedAt, false);
  let status: ForwardRunReceipt["status"] = "failed";
  let errorCode: string | undefined;
  try {
    await adapter.preflight({
      cwd: options.sourceRoot,
      hostHome: options.hostHome,
      sessionDir,
    });
    if (adapter.isolation !== "workspace-offline") {
      throw new EvaluationError(
        "EVAL_HOST_ISOLATION_UNAVAILABLE",
        `${options.host} does not expose a verified offline workspace-only transport.`,
      );
    }
    for (const scenarioId of forwardScenarioIds) {
      const scenarioDirectory = join(outputDirectory, "scenarios", scenarioId);
      const workspace = join(scenarioDirectory, "workspace");
      const resultPath = ".maestro-eval/forward-result.json";
      const prompt = buildForwardPrompt({
        candidateSha: options.candidateSha,
        host: options.host,
        runId: options.runId,
        scenarioId,
        resultPath,
        artifactId: forwardScenarioContracts[scenarioId].artifactId,
        command: forwardScenarioContracts[scenarioId].command,
      });
      await mkdir(scenarioDirectory, { recursive: true });
      try {
        await prepareWorkspace({
          sourceRoot: options.sourceRoot,
          candidateSha: options.candidateSha,
          workspace,
          sessionDir,
        });
        await provisionReleaseTag({
          workspace,
          candidateSha: options.candidateSha,
          scenarioId,
        });
        const result = await adapter.run({
          cwd: workspace,
          hostHome: options.hostHome,
          sessionDir,
          prompt,
          timeoutMs: options.timeoutMs ?? 45 * 60 * 1000,
          networkAccess: false,
          ...(options.codexTransport
            ? { codexTransport: options.codexTransport }
            : {}),
        });
        await writeFile(
          join(scenarioDirectory, "host.stdout.log"),
          redactForwardLog(result.stdout),
          "utf8",
        );
        await writeFile(
          join(scenarioDirectory, "host.stderr.log"),
          redactForwardLog(result.stderr),
          "utf8",
        );
        await assertReleaseTag({
          workspace,
          candidateSha: options.candidateSha,
          scenarioId,
        });
        if (result.exitCode !== 0) {
          throw new EvaluationError(
            "EVAL_HOST_EXECUTION_FAILED",
            `${options.host} failed scenario ${scenarioId}.`,
          );
        }
        let raw: unknown;
        try {
          raw = JSON.parse(await readFile(join(workspace, resultPath), "utf8"));
        } catch {
          throw new EvaluationError(
            "EVAL_RESULT_MISSING",
            `Host did not write evidence for ${scenarioId}.`,
          );
        }
        let parsed: ForwardRunEvidence;
        try {
          parsed = parseForwardRunEvidence(raw);
        } catch {
          throw new EvaluationError(
            "EVAL_RESULT_INVALID",
            `Host evidence is invalid for ${scenarioId}.`,
          );
        }
        const verification = await verifyForwardScenario({
          workspace,
          sessionDir,
          candidateSha: options.candidateSha,
          scenarioId,
          evidence: parsed,
          ...(overrides.verifierPorts
            ? { ports: overrides.verifierPorts }
            : {}),
        });
        const verifierFailures = [...verification.failures];
        if (verification.commandResult !== undefined) {
          await writeJson(join(scenarioDirectory, "command-result.json"), {
            exitCode: verification.commandResult.exitCode,
            stdout: redactForwardLog(verification.commandResult.stdout),
            stderr: redactForwardLog(verification.commandResult.stderr),
          });
        }
        if (
          verifierFailures.length === 0 &&
          verification.commandResult !== undefined
        ) {
          const artifact = await readFile(
            join(
              workspace,
              ".maestro-eval",
              "artifacts",
              `${forwardScenarioContracts[scenarioId].artifactId}.json`,
            ),
          );
          const retainedRoot = join(
            scenarioDirectory,
            "retained-verifier-inputs",
          );
          const retainedArtifact = join(
            retainedRoot,
            ".maestro-eval",
            "artifacts",
            `${forwardScenarioContracts[scenarioId].artifactId}.json`,
          );
          await mkdir(dirname(retainedArtifact), { recursive: true });
          await writeFile(retainedArtifact, artifact);
          const artifactValue = JSON.parse(artifact.toString("utf8")) as {
            readonly files: readonly { readonly path: string }[];
          };
          for (const file of artifactValue.files) {
            const source = resolve(workspace, file.path);
            const target = resolve(retainedRoot, file.path);
            const rel = relative(retainedRoot, target);
            if (rel === "" || rel === ".." || rel.startsWith("../")) {
              throw new EvaluationError(
                "EVAL_ASSERTION_FAILED",
                "Verified product evidence escapes retained inputs.",
              );
            }
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, await readFile(source));
          }
        }
        const verdict = gradeForwardEvidence({
          evidence: parsed,
          candidateSha: options.candidateSha,
          host: options.host,
          runId: options.runId,
          scenarioId,
          initialContextSha256: forwardInitialContextSha256({
            candidateSha: options.candidateSha,
            host: options.host,
            scenarioId,
          }),
          userPromptSha256: sha256(prompt),
          verifierFailures,
        });
        evidence.push(parsed);
        verdicts.push(verdict);
        await writeJson(
          join(scenarioDirectory, "evidence.redacted.json"),
          redactForwardJson(parsed),
        );
        await writeJson(join(scenarioDirectory, "verdict.json"), verdict);
        if (verdict.status !== "passed") {
          throw new EvaluationError(
            "EVAL_ASSERTION_FAILED",
            `Forward grading failed for ${scenarioId}.`,
          );
        }
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    }
    ensureCompleteEvidence(evidence);
    status = "passed";
  } catch (error) {
    const classified =
      error instanceof EvaluationError
        ? error
        : new EvaluationError(
            "EVAL_HOST_EXECUTION_FAILED",
            "Forward execution failed unexpectedly.",
          );
    errorCode = classified.code;
    status =
      classified.code === "EVAL_HOST_EXECUTABLE_UNAVAILABLE" ||
      classified.code === "EVAL_HOST_AUTH_REQUIRED" ||
      classified.code === "EVAL_HOST_ISOLATION_UNAVAILABLE"
        ? "blocked-external"
        : "failed";
    await writeRetention(outputDirectory, startedAt, true);
    const receipt = buildReceipt();
    await writeJson(join(outputDirectory, "receipt.json"), receipt);
    if (status === "blocked-external") return receipt;
    throw classified;
  } finally {
    await rm(sessionDir, { recursive: true, force: true });
  }
  const receipt = buildReceipt();
  await writeJson(join(outputDirectory, "receipt.json"), receipt);
  return receipt;

  function buildReceipt(): ForwardRunReceipt {
    return {
      schemaVersion: 1,
      suite: "forward",
      host: options.host,
      runId: options.runId,
      candidateSha: options.candidateSha,
      status,
      startedAt,
      completedAt: now().toISOString(),
      outputDirectory: relativeOutputDirectory(options.out, outputDirectory),
      workspaceRetained: false,
      evidence:
        status === "passed"
          ? evidence
          : (evidence.map((entry) =>
              redactForwardJson(entry),
            ) as ForwardRunEvidence[]),
      verdicts,
      ...(errorCode ? { errorCode } : {}),
    };
  }
}

function ensureCompleteEvidence(evidence: readonly ForwardRunEvidence[]): void {
  const ids = evidence.map(({ scenarioId }) => scenarioId);
  if (
    ids.length !== forwardScenarioIds.length ||
    new Set(ids).size !== ids.length ||
    forwardScenarioIds.some((id) => !ids.includes(id))
  ) {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "Forward run must contain each frozen scenario exactly once.",
    );
  }
}

function validateOptions(options: ForwardRunOptions): void {
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
}

async function writeRetention(
  directory: string,
  startedAt: string,
  failed: boolean,
): Promise<void> {
  const days = failed ? 30 : 14;
  await writeJson(join(directory, "retention.json"), {
    schemaVersion: 1,
    retainedArtifacts: [
      "redacted host logs",
      "redacted evidence",
      "verdicts",
      "receipt",
    ],
    workspaceRetained: false,
    passedRunDays: 14,
    failedRunMaximumDays: 30,
    deleteAfter: new Date(
      Date.parse(startedAt) + days * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function redactForwardLog(value: string): string {
  return redactText(value)
    .replace(
      /(?:^|[\s"'])(\/(?:Users|home|data|tmp|private|var)\/[^\s"']+)/gu,
      (match, path: string) => match.replace(path, "[REDACTED_PATH]"),
    )
    .replace(/[A-Za-z]:\\[^\s"']+/gu, "[REDACTED_PATH]");
}

function redactForwardJson(value: unknown): unknown {
  const redacted = redactJson(value);
  if (typeof redacted === "string") return redactForwardLog(redacted);
  if (Array.isArray(redacted)) return redacted.map(redactForwardJson);
  if (redacted === null || typeof redacted !== "object") return redacted;
  return Object.fromEntries(
    Object.entries(redacted).map(([key, entry]) => [
      key,
      redactForwardJson(entry),
    ]),
  );
}

function relativeOutputDirectory(out: string, directory: string): string {
  const relative = directory.slice(resolve(out).length + 1);
  if (relative.length === 0 || relative.startsWith("..")) {
    throw new EvaluationError(
      "EVAL_INVALID_ARGUMENT",
      "Run output directory escapes --out.",
    );
  }
  return relative;
}
