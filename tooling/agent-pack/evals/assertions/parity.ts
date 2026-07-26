import type { ForwardCanonicalProjection } from "../scenarios/evidence.js";
import type { AssertionFailure, AssertionResult } from "./forbiddenActions.js";

export function assertForwardParity(input: {
  readonly claude: ForwardCanonicalProjection;
  readonly codex: ForwardCanonicalProjection;
}): AssertionResult {
  const failures: AssertionFailure[] = [
    ...uniqueIdFailures("claude", input.claude),
    ...uniqueIdFailures("codex", input.codex),
  ];
  if (failures.length > 0) return { ok: false, failures };
  compare(
    failures,
    "candidateSha",
    input.claude.candidateSha,
    input.codex.candidateSha,
  );
  compare(
    failures,
    "scenarioId",
    input.claude.scenarioId,
    input.codex.scenarioId,
  );
  compare(
    failures,
    "artifacts",
    sortById(input.claude.artifacts),
    sortById(input.codex.artifacts),
  );
  compare(failures, "commands", input.claude.commands, input.codex.commands);
  compare(
    failures,
    "forbiddenActions",
    sortById(input.claude.forbiddenActions),
    sortById(input.codex.forbiddenActions),
  );
  compare(
    failures,
    "receiptSha256",
    input.claude.receiptSha256,
    input.codex.receiptSha256,
  );
  return { ok: failures.length === 0, failures };
}

function uniqueIdFailures(
  host: "claude" | "codex",
  projection: ForwardCanonicalProjection,
): AssertionFailure[] {
  return [
    ...duplicates(projection.artifacts).map((id) => ({
      code: "CANONICAL_ID_DUPLICATE",
      path: `${host}.artifacts.${id}`,
      message: `Duplicate canonical artifact ID: ${id}.`,
    })),
    ...duplicates(projection.commands).map((id) => ({
      code: "CANONICAL_ID_DUPLICATE",
      path: `${host}.commands.${id}`,
      message: `Duplicate canonical command ID: ${id}.`,
    })),
    ...duplicates(projection.forbiddenActions).map((id) => ({
      code: "CANONICAL_ID_DUPLICATE",
      path: `${host}.forbiddenActions.${id}`,
      message: `Duplicate forbidden-action ID: ${id}.`,
    })),
  ];
}

function duplicates(values: readonly { readonly id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const { id } of values) {
    if (seen.has(id)) duplicate.add(id);
    seen.add(id);
  }
  return [...duplicate].sort();
}

function sortById<Value extends { readonly id: string }>(
  values: readonly Value[],
): readonly Value[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function compare(
  failures: AssertionFailure[],
  path: string,
  claude: unknown,
  codex: unknown,
): void {
  if (JSON.stringify(claude) === JSON.stringify(codex)) return;
  failures.push({
    code: "HOST_PARITY_DIVERGED",
    path,
    message: `Claude and Codex canonical ${path} differ.`,
  });
}
