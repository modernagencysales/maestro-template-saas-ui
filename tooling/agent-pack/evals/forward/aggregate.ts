import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assertForwardParity } from "../assertions/parity.js";
import {
  parseForwardRunEvidence,
  type ForwardRunEvidence,
} from "../scenarios/evidence.js";
import { forwardScenarioIds } from "../scenarios/forward.js";
import { EvaluationError } from "../walking-skeleton/contract.js";
import type { ForwardRunReceipt } from "./runner.js";

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
    input.runIds.map(async (runId) =>
      parseReceipt(
        JSON.parse(
          await readFile(
            join(resolve(input.out), runId, "receipt.json"),
            "utf8",
          ),
        ),
      ),
    ),
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

function parseReceipt(value: unknown): ForwardRunReceipt {
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
    typeof receipt.candidateSha !== "string" ||
    !Array.isArray(receipt.evidence)
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
}
