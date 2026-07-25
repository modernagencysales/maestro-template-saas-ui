import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  EvaluationError,
  isRecord,
  type CanonicalEvidenceHashes,
  type EvaluationHost,
} from "./contract.js";

type AggregateReceipt = {
  readonly host: EvaluationHost;
  readonly runId: string;
  readonly candidateSha: string;
  readonly status: "passed";
  readonly canonicalHashes: CanonicalEvidenceHashes;
};

export type WalkingSkeletonSuiteVerdict = {
  readonly schemaVersion: 1;
  readonly suite: "walking-skeleton";
  readonly status: "passed";
  readonly candidateSha: string;
  readonly runIds: readonly string[];
  readonly canonicalHashes: CanonicalEvidenceHashes;
};

export async function aggregateWalkingSkeletonRuns(input: {
  readonly out: string;
  readonly runIds: readonly string[];
  readonly candidateSha: string;
  readonly suiteRunId: string;
}): Promise<WalkingSkeletonSuiteVerdict> {
  if (input.runIds.length !== 4 || new Set(input.runIds).size !== 4) {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "Aggregation requires four distinct run IDs.",
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
      "One or more run receipts are missing or invalid.",
    );
  });
  const hosts = receipts.map((receipt) => receipt.host).sort();
  if (hosts.join(",") !== "claude,claude,codex,codex") {
    throw new EvaluationError(
      "EVAL_SUITE_INCOMPLETE",
      "The suite requires exactly two Claude and two Codex passes.",
    );
  }
  if (receipts.some((receipt) => receipt.candidateSha !== input.candidateSha)) {
    throw new EvaluationError(
      "EVAL_SUITE_DIVERGED",
      "Run receipts do not share the pinned candidate SHA.",
    );
  }
  const baseline = receipts[0]?.canonicalHashes;
  if (
    !baseline ||
    receipts.some(
      (receipt) =>
        JSON.stringify(receipt.canonicalHashes) !== JSON.stringify(baseline),
    )
  ) {
    throw new EvaluationError(
      "EVAL_SUITE_DIVERGED",
      "Claude and Codex did not produce equivalent canonical evidence.",
    );
  }
  const verdict: WalkingSkeletonSuiteVerdict = {
    schemaVersion: 1,
    suite: "walking-skeleton",
    status: "passed",
    candidateSha: input.candidateSha,
    runIds: [...input.runIds].sort(),
    canonicalHashes: baseline,
  };
  const path = join(resolve(input.out), `${input.suiteRunId}.suite.json`);
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

function parseReceipt(value: unknown): AggregateReceipt {
  if (
    !isRecord(value) ||
    (value.host !== "claude" && value.host !== "codex") ||
    typeof value.runId !== "string" ||
    typeof value.candidateSha !== "string" ||
    value.status !== "passed" ||
    !isRecord(value.canonicalHashes)
  ) {
    throw new Error("invalid receipt");
  }
  return value as AggregateReceipt;
}
