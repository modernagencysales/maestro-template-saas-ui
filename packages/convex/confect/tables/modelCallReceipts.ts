import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const ModelCallState = Schema.Literal(
  "queued",
  "running",
  "succeeded",
  "retryable_failure",
  "permanent_failure",
  "cancelled",
);

export const ModelCallReceiptRow = Schema.Struct({
  workspaceId: Schema.String,
  attemptKey: Schema.String,
  provider: Schema.Literal("openrouter"),
  model: Schema.String,
  region: Schema.Literal("us", "eu", "local"),
  state: ModelCallState,
  trustedInstructionVersion: Schema.String,
  toolSchemaVersion: Schema.String,
  requestHash: Schema.String,
  responseHash: Schema.optional(Schema.String),
  sourceHash: Schema.String,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  costCents: Schema.Number,
  latencyMs: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
});

export default Table.make(() => ModelCallReceiptRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_attempt", ["attemptKey"])
  .index("by_workspace_attempt", ["workspaceId", "attemptKey"])
  .index("by_workspace_state", ["workspaceId", "state"])
  .index("by_request_hash", ["requestHash"])
  .index("by_source_hash", ["sourceHash"])
  .index("by_provider_model", ["provider", "model"]);
