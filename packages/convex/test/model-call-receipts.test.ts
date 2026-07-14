import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import modelCallReceipts, {
  ModelCallReceiptRow,
  ModelCallState,
} from "../confect/tables/modelCallReceipts";

describe("model call receipt table", () => {
  it("declares append-friendly attempt, tenant, state, hash, and provider indexes", () => {
    expect(modelCallReceipts.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_attempt: ["attemptKey"],
      by_workspace_attempt: ["workspaceId", "attemptKey"],
      by_workspace_state: ["workspaceId", "state"],
      by_request_hash: ["requestHash"],
      by_source_hash: ["sourceHash"],
      by_provider_model: ["provider", "model"],
    });
  });

  it("validates lifecycle states and stores only hashes/usage, not raw prompts", () => {
    expect(Schema.decodeUnknownSync(ModelCallState)("queued")).toBe("queued");
    expect(Schema.decodeUnknownSync(ModelCallState)("succeeded")).toBe(
      "succeeded",
    );
    expect(() => Schema.decodeUnknownSync(ModelCallState)("unknown")).toThrow();

    const row = Schema.decodeUnknownSync(ModelCallReceiptRow)({
      workspaceId: "workspaces_123",
      attemptKey: "attempt-001",
      provider: "openrouter",
      model: "openrouter/fake-structured",
      region: "us",
      state: "succeeded",
      trustedInstructionVersion: "classify-v1",
      toolSchemaVersion: "routing-v1",
      requestHash: "sha256:req",
      responseHash: "sha256:res",
      sourceHash: "sha256:source",
      inputTokens: 10,
      outputTokens: 5,
      costCents: 1,
      latencyMs: 12,
      createdAt: 1770000000000,
    });

    expect(row).toMatchObject({
      requestHash: "sha256:req",
      responseHash: "sha256:res",
    });
    expect(JSON.stringify(row)).not.toContain("prompt");
    expect(JSON.stringify(row)).not.toContain("completion");
  });
});
