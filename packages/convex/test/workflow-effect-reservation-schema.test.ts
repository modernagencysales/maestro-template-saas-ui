import * as Either from "effect/Either";
import { describe, expect, it } from "vitest";

import { decodeWorkflowEffectReservationRow } from "../confect/tables/workflowEffectReservations";

const row = {
  workspaceId: "workspace_123",
  workflowRunId: "run_123",
  workflowId: "workflow_publishBrief",
  workflowVersion: 2,
  generation: 0,
  stepName: "publish-brief.v2",
  logicalEffectKey: "effect_v1_abc123",
  capabilityRef: "capability.publishBrief.v2",
  effectClass: "external",
  strategy: "provider-native",
  state: "reserved",
  reconciliationState: "not-required",
  approvalCheck: "passed",
  quotaRateCheck: "passed",
  spendKillSwitchCheck: "passed",
  providerCorrelationHash: "sha256:abc123",
  dedupeExpiresAt: 20_000,
  restartSafeUntil: 10_000,
  occurredAt: 1_000,
  appendOnly: true,
} as const;

describe("workflow effect reservation schema", () => {
  it("decodes the append-only workspace-owned retry record", () => {
    expect(Either.getOrThrow(decodeWorkflowEffectReservationRow(row))).toEqual(
      row,
    );
  });

  it.each([
    { field: "strategy", value: "idempotent" },
    { field: "state", value: "retrying" },
    { field: "reconciliationState", value: "guess-retryable" },
    { field: "appendOnly", value: false },
  ])("rejects invalid $field", ({ field, value }) => {
    expect(
      Either.isLeft(
        decodeWorkflowEffectReservationRow({ ...row, [field]: value }),
      ),
    ).toBe(true);
  });

  it("rejects raw provider payload storage", () => {
    expect(
      Either.isLeft(
        decodeWorkflowEffectReservationRow({
          ...row,
          providerPayload: { secret: "must-not-persist" },
        }),
      ),
    ).toBe(true);
  });
});
