import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export const FeatureFlagKey = Schema.Literals([
  "template.onboarding.workspaceBrief",
  "template.workflow.liveRuns",
  "template.billing.liveCheckout",
  "template.notifications.center",
  "template.ai.liveGeneration",
]);

export const FeatureFlagAudience = Schema.Literals([
  "everyone",
  "internal",
  "workspace",
]);

export const FeatureFlagPolicyRow = Schema.Struct({
  workspaceId: Schema.String,
  key: FeatureFlagKey,
  description: Schema.String,
  enabled: Schema.Boolean,
  rolloutPercent: Schema.Number,
  audience: FeatureFlagAudience,
  killSwitchEnv: Schema.optional(Schema.String),
  source: Schema.Literals(["default", "workspace"]),
  updatedAt: Schema.Number,
});

export default Table.make(() => FeatureFlagPolicyRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_key", ["workspaceId", "key"])
  .index("by_key", ["key"]);
