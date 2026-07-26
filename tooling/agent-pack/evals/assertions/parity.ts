import type { ForwardCanonicalProjection } from "../scenarios/evidence.js";
import type { AssertionFailure, AssertionResult } from "./forbiddenActions.js";

const parityFields = [
  "candidateSha",
  "scenarioId",
  "artifacts",
  "commands",
  "receiptSha256",
] as const satisfies readonly (keyof ForwardCanonicalProjection)[];

export function assertForwardParity(input: {
  readonly claude: ForwardCanonicalProjection;
  readonly codex: ForwardCanonicalProjection;
}): AssertionResult {
  const failures: AssertionFailure[] = [];
  for (const field of parityFields) {
    if (
      canonicalJson(input.claude[field]) !== canonicalJson(input.codex[field])
    ) {
      failures.push({
        code: "HOST_PARITY_DIVERGED",
        path: field,
        message: `Claude and Codex canonical ${field} differ.`,
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}
