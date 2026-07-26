import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assertForwardParity } from "../assertions/parity.js";
import {
  parseForwardRunEvidence,
  type ForwardRunEvidence,
} from "../scenarios/evidence.js";
import { forwardScenarioIds } from "../scenarios/forward.js";
import { EvaluationError } from "../walking-skeleton/contract.js";
import {
  buildForwardPrompt,
  forwardInitialContextSha256,
  gradeForwardEvidence,
  sha256,
} from "./contract.js";
import type { ForwardRunReceipt } from "./runner.js";
import { forwardReceiptSha256, forwardScenarioContracts } from "./verifier.js";

export type ForwardSuiteVerdict = {
  readonly schemaVersion: 1;
  readonly suite: "forward";
  readonly status: "passed";
  readonly candidateSha: string;
  readonly runIds: readonly string[];
  readonly scenarioIds: readonly string[];
};

export async function aggregateForwardRuns(input: {
  readonly out: string;
  readonly runIds: readonly string[];
  readonly candidateSha: string;
  readonly suiteRunId: string;
}): Promise<ForwardSuiteVerdict> {
  if (input.runIds.length !== 4 || new Set(input.runIds).size !== 4) {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "Forward aggregation requires four distinct run IDs.",
    );
  }
  const receipts = await Promise.all(
    input.runIds.map(async (runId) => {
      const receipt = parseReceipt(
        JSON.parse(
          await readFile(
            join(resolve(input.out), runId, "receipt.json"),
            "utf8",
          ),
        ),
        runId,
      );
      await verifyRetainedEvidence(resolve(input.out), receipt);
      return receipt;
    }),
  ).catch(() => {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "One or more forward receipts are missing or invalid.",
    );
  });
  const hosts = receipts
    .map(({ host }) => host)
    .sort()
    .join(",");
  if (hosts !== "claude,claude,codex,codex") {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "Forward aggregation requires exactly two Claude and two Codex runs.",
    );
  }
  if (
    receipts.some(({ candidateSha }) => candidateSha !== input.candidateSha)
  ) {
    throw new EvaluationError(
      "EVAL_SUITE_DIVERGED",
      "Forward receipts contain stale or mixed candidate SHAs.",
    );
  }
  for (const receipt of receipts) assertCompleteReceipt(receipt);
  for (const scenarioId of forwardScenarioIds) {
    const projections = receipts.map(
      (receipt) =>
        receipt.evidence.find((entry) => entry.scenarioId === scenarioId) as
          ForwardRunEvidence | undefined,
    );
    const baseline = projections[0];
    if (!baseline || projections.some((entry) => entry === undefined)) {
      throw new EvaluationError(
        "EVAL_SUITE_INCOMPLETE",
        `Missing scenario ${scenarioId}.`,
      );
    }
    for (const candidate of projections.slice(1)) {
      if (!candidate) continue;
      const parity = assertForwardParity({
        claude: baseline,
        codex: candidate,
      });
      if (!parity.ok) {
        throw new EvaluationError(
          "EVAL_SUITE_DIVERGED",
          `Forward host parity drifted for ${scenarioId}.`,
        );
      }
    }
  }
  const verdict: ForwardSuiteVerdict = {
    schemaVersion: 1,
    suite: "forward",
    status: "passed",
    candidateSha: input.candidateSha,
    runIds: [...input.runIds].sort(),
    scenarioIds: forwardScenarioIds,
  };
  const path = join(
    resolve(input.out),
    `${input.suiteRunId}.forward-suite.json`,
  );
  try {
    await writeFile(path, `${JSON.stringify(verdict, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch {
    throw new EvaluationError(
      "EVAL_OUTPUT_EXISTS",
      `Suite output already exists: ${path}`,
    );
  }
  return verdict;
}

async function verifyRetainedEvidence(
  out: string,
  receipt: ForwardRunReceipt,
): Promise<void> {
  for (const evidence of receipt.evidence) {
    const scenarioRoot = join(
      out,
      receipt.runId,
      "scenarios",
      evidence.scenarioId,
    );
    const artifact = await readFile(
      join(scenarioRoot, "artifact.verified.json"),
    );
    const summary = JSON.parse(
      await readFile(join(scenarioRoot, "verification-summary.json"), "utf8"),
    ) as unknown;
    const expected = {
      schemaVersion: 1,
      candidateSha: evidence.candidateSha,
      scenarioId: evidence.scenarioId,
      artifactSha256: evidence.artifacts[0]?.sha256,
      commandOutputSha256: evidence.commands[0]?.outputSha256,
      receiptSha256: evidence.receiptSha256,
    };
    if (
      sha256(artifact) !== evidence.artifacts[0]?.sha256 ||
      JSON.stringify(summary) !== JSON.stringify(expected)
    ) {
      throw new Error("retained verification evidence mismatch");
    }
  }
}

function parseReceipt(
  value: unknown,
  expectedRunId: string,
): ForwardRunReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid receipt");
  }
  const receipt = value as Partial<ForwardRunReceipt>;
  if (
    receipt.schemaVersion !== 1 ||
    receipt.suite !== "forward" ||
    receipt.status !== "passed" ||
    (receipt.host !== "claude" && receipt.host !== "codex") ||
    typeof receipt.runId !== "string" ||
    receipt.runId !== expectedRunId ||
    receipt.outputDirectory !== expectedRunId ||
    typeof receipt.candidateSha !== "string" ||
    !Array.isArray(receipt.evidence) ||
    !Array.isArray(receipt.verdicts)
  ) {
    throw new Error("invalid receipt");
  }
  const evidence = receipt.evidence.map(parseForwardRunEvidence);
  return { ...receipt, evidence } as ForwardRunReceipt;
}

function assertCompleteReceipt(receipt: ForwardRunReceipt): void {
  const ids = receipt.evidence.map(({ scenarioId }) => scenarioId);
  if (
    ids.length !== forwardScenarioIds.length ||
    new Set(ids).size !== ids.length ||
    forwardScenarioIds.some((id) => !ids.includes(id))
  ) {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "A forward receipt has missing, duplicate, or unknown scenarios.",
    );
  }
  if (
    receipt.evidence.some(
      (entry) =>
        entry.candidateSha !== receipt.candidateSha ||
        entry.host !== receipt.host ||
        entry.runId !== receipt.runId,
    )
  ) {
    throw new EvaluationError(
      "EVAL_SUITE_DIVERGED",
      "A forward receipt contains stale or cross-run evidence.",
    );
  }
  if (receipt.verdicts.length !== forwardScenarioIds.length) {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "A forward receipt does not contain every stored scenario verdict.",
    );
  }
  for (const evidence of receipt.evidence) {
    const contract = forwardScenarioContracts[evidence.scenarioId];
    const prompt = buildForwardPrompt({
      candidateSha: receipt.candidateSha,
      host: receipt.host,
      runId: receipt.runId,
      scenarioId: evidence.scenarioId,
      resultPath: ".maestro-eval/forward-result.json",
      artifactId: contract.artifactId,
      commandId: contract.command.id,
    });
    const verifierFailures =
      evidence.receiptSha256 === forwardReceiptSha256(evidence)
        ? []
        : [
            {
              code: "RECEIPT_HASH_MISMATCH",
              path: "receiptSha256",
              message: "Canonical receipt hash does not match evidence.",
            },
          ];
    const regraded = gradeForwardEvidence({
      evidence,
      candidateSha: receipt.candidateSha,
      host: receipt.host,
      runId: receipt.runId,
      scenarioId: evidence.scenarioId,
      initialContextSha256: forwardInitialContextSha256({
        candidateSha: receipt.candidateSha,
        host: receipt.host,
        scenarioId: evidence.scenarioId,
      }),
      userPromptSha256: sha256(prompt),
      verifierFailures,
    });
    const stored = receipt.verdicts.find(
      ({ scenarioId }) => scenarioId === evidence.scenarioId,
    );
    if (
      regraded.status !== "passed" ||
      !stored ||
      JSON.stringify(stored) !== JSON.stringify(regraded)
    ) {
      throw new EvaluationError(
        "EVAL_SUITE_DIVERGED",
        `Forward receipt verdict cannot be reproduced for ${evidence.scenarioId}.`,
      );
    }
  }
}
