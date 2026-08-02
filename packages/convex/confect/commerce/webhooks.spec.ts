import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { ConfigInvalid, ValidationFailed } from "../errors";

export class WebhookRejected extends Schema.TaggedError<WebhookRejected>()(
  "WebhookRejected",
  {
    reason: Schema.String,
  },
) {}

const WebhookResult = Schema.Struct({
  eventId: Schema.String,
  status: Schema.Literal("processed", "duplicate"),
});

const ApplyDodoArgs = Schema.Struct({
  rawBody: Schema.String,
  webhookId: Schema.String,
  signature: Schema.optional(Schema.String),
  signatureTimestamp: Schema.optional(Schema.String),
});

export const applyDodo = FunctionSpec.publicAction({
  name: "applyDodo",
  args: () => ApplyDodoArgs,
  returns: () => WebhookResult,
  error: () => Schema.Union(ConfigInvalid, ValidationFailed, WebhookRejected),
});

export const applyVerifiedDodo = FunctionSpec.internalMutation({
  name: "applyVerifiedDodo",
  args: () =>
    Schema.Struct({
      rawBody: Schema.String,
      eventId: Schema.String,
      signatureTimestamp: Schema.String,
    }),
  returns: () => WebhookResult,
  error: () => Schema.Union(ValidationFailed, WebhookRejected),
});

export const markAdmaxxerReported = FunctionSpec.internalMutation({
  name: "markAdmaxxerReported",
  args: () =>
    Schema.Struct({
      paymentId: Schema.String,
      reportedAt: Schema.Number,
    }),
  returns: () => Schema.Boolean,
  error: () => Schema.Union(ValidationFailed, WebhookRejected),
});

export default GroupSpec.make()
  .addFunction(applyDodo)
  .addFunction(applyVerifiedDodo)
  .addFunction(markAdmaxxerReported);
