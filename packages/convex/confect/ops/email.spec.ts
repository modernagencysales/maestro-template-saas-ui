import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "../_generated/id";
import {
  Forbidden,
  MemberNotInWorkspace,
  NoRecoverableError,
  NotFound,
  Unauthorized,
  ValidationFailed,
  WorkspaceNotFound,
} from "../errors";
import { EmailDeliveryStatus } from "../tables/emailDeliveries";
import { EmailEventKind } from "../tables/emailEvents";
import { EmailSubscriberStatus } from "../tables/emailSubscribers";
import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
} from "../capabilities/_kit/capability";

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));
const EmailError = Schema.Union([
  Unauthorized,
  Forbidden,
  MemberNotInWorkspace,
  WorkspaceNotFound,
  NotFound,
  ValidationFailed,
]);

export const SubscribeEmailArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  email: NonEmptyString,
  marketingOptIn: Schema.Boolean,
  consentVersion: NonEmptyString,
  consentSource: NonEmptyString,
});

export const UnsubscribeEmailArgs = Schema.Struct({
  subscriberId: Id("emailSubscribers"),
});

export const BroadcastPreviewArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
});

export const BroadcastPreviewReturn = Schema.Struct({
  eligibleRecipients: Schema.Number.pipe(Schema.check(Schema.isInt())),
  capped: Schema.Boolean,
});

export const SendTransactionalArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  recipientId: Schema.optional(Id("users")),
  to: NonEmptyString,
  templateAlias: NonEmptyString,
  templateModelJson: Schema.String,
  idempotencyKey: NonEmptyString,
});

export const DispatchBroadcastArgs = Schema.Struct({
  workspaceId: Id("workspaces"),
  idempotencyKey: NonEmptyString,
  subject: NonEmptyString,
  preheader: Schema.String,
  textBody: NonEmptyString,
  htmlBody: NonEmptyString,
  confirmation: Schema.Literal("SEND"),
});

export const ProviderEventArgs = Schema.Struct({
  fingerprint: NonEmptyString,
  kind: EmailEventKind,
  recipient: NonEmptyString,
  providerMessageId: Schema.optional(NonEmptyString),
});

export const PrepareBroadcastReturn = Schema.Struct({
  campaignId: Id("emailCampaigns"),
  eligibleRecipients: Schema.Number,
  capped: Schema.Boolean,
});

export const CampaignRecipientReturn = Schema.Struct({
  subscriberId: Id("emailSubscribers"),
  email: Schema.String,
  eligible: Schema.Boolean,
});

export const ClaimTransactionalReturn = Schema.Struct({
  deliveryId: Id("emailDeliveries"),
  status: EmailDeliveryStatus,
  shouldSend: Schema.Boolean,
  providerMessageId: Schema.optional(Schema.String),
});

export const RecordTransactionalResultArgs = Schema.Struct({
  deliveryId: Id("emailDeliveries"),
  status: EmailDeliveryStatus,
  providerMessageId: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
});

export const BroadcastRecipientResult = Schema.Struct({
  subscriberId: Id("emailSubscribers"),
  status: EmailDeliveryStatus,
  providerMessageId: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
});

export const RecordBroadcastResultsArgs = Schema.Struct({
  campaignId: Id("emailCampaigns"),
  results: Schema.Array(BroadcastRecipientResult),
});

export const SubscriberReturn = Schema.Struct({
  subscriberId: Id("emailSubscribers"),
  workspaceId: Id("workspaces"),
  email: Schema.String,
  status: EmailSubscriberStatus,
  consentedAt: Schema.Number,
  unsubscribedAt: Schema.optional(Schema.Number),
});

export const DeliveryReturn = Schema.Struct({
  deliveryId: Id("emailDeliveries"),
  status: EmailDeliveryStatus,
  providerMessageId: Schema.optional(Schema.String),
  retryable: Schema.Boolean,
});

export const BroadcastDispatchReturn = Schema.Struct({
  campaignId: Id("emailCampaigns"),
  eligibleRecipients: Schema.Number,
  accepted: Schema.Number,
  failed: Schema.Number,
  capped: Schema.Boolean,
});

export const ProviderEventReturn = Schema.Struct({
  status: Schema.Literals(["processed", "duplicate"]),
  suppressed: Schema.Boolean,
});

const subscribe = FunctionSpec.publicMutation({
  name: "subscribe",
  args: () => SubscribeEmailArgs,
  returns: () => SubscriberReturn,
  error: () => EmailError,
});

const unsubscribe = FunctionSpec.internalMutation({
  name: "unsubscribe",
  args: () => UnsubscribeEmailArgs,
  returns: () => SubscriberReturn,
  error: () => Schema.Union([NotFound]),
});

const previewBroadcastContract = defineContractFunction(
  FunctionSpec.publicQuery({
    name: "previewBroadcast",
    args: () => BroadcastPreviewArgs,
    returns: () => BroadcastPreviewReturn,
    error: () => EmailError,
  }),
  {
    namespace: "ops.email",
    name: "previewBroadcast",
    operationId: "ops.email.previewBroadcast",
    kind: "query",
    surfaces: ["api", "cli", "mcp", "web"],
    typedErrors: [
      "Unauthorized",
      "Forbidden",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: true,
    argsSchemaName: "ops.email.previewBroadcast.args",
    returnsSchemaName: "ops.email.previewBroadcast.returns",
    argsSchema: BroadcastPreviewArgs,
    returnsSchema: BroadcastPreviewReturn,
  },
);
const previewBroadcast = previewBroadcastContract.spec;

const sendTransactional = FunctionSpec.internalAction({
  name: "sendTransactional",
  args: () => SendTransactionalArgs,
  returns: () => DeliveryReturn,
  error: () => Schema.Union([ValidationFailed]),
});

const claimTransactional = FunctionSpec.internalMutation({
  name: "claimTransactional",
  args: () => SendTransactionalArgs,
  returns: () => ClaimTransactionalReturn,
  error: () => Schema.Union([ValidationFailed]),
});

const recordTransactionalResult = FunctionSpec.internalMutation({
  name: "recordTransactionalResult",
  args: () => RecordTransactionalResultArgs,
  returns: () => DeliveryReturn,
  error: () => NoRecoverableError,
});

const prepareBroadcast = FunctionSpec.publicMutation({
  name: "prepareBroadcast",
  args: () => DispatchBroadcastArgs,
  returns: () => PrepareBroadcastReturn,
  error: () => EmailError,
});

const listCampaignRecipients = FunctionSpec.internalQuery({
  name: "listCampaignRecipients",
  args: () => Schema.Struct({ campaignId: Id("emailCampaigns") }),
  returns: () => Schema.Array(CampaignRecipientReturn),
  error: () => NoRecoverableError,
});

const recordBroadcastResults = FunctionSpec.internalMutation({
  name: "recordBroadcastResults",
  args: () => RecordBroadcastResultsArgs,
  returns: () => BroadcastDispatchReturn,
  error: () => NoRecoverableError,
});

const dispatchBroadcastContract = defineContractFunction(
  FunctionSpec.publicAction({
    name: "dispatchBroadcast",
    args: () => DispatchBroadcastArgs,
    returns: () => BroadcastDispatchReturn,
    error: () => EmailError,
  }),
  {
    namespace: "ops.email",
    name: "dispatchBroadcast",
    operationId: "ops.email.dispatchBroadcast",
    kind: "action",
    surfaces: ["api", "cli", "mcp", "web"],
    typedErrors: [
      "Unauthorized",
      "Forbidden",
      "MemberNotInWorkspace",
      "WorkspaceNotFound",
      "ValidationFailed",
    ],
    idempotent: false,
    argsSchemaName: "ops.email.dispatchBroadcast.args",
    returnsSchemaName: "ops.email.dispatchBroadcast.returns",
    argsSchema: DispatchBroadcastArgs,
    returnsSchema: BroadcastDispatchReturn,
  },
);
const dispatchBroadcast = dispatchBroadcastContract.spec;

const processProviderEvent = FunctionSpec.internalMutation({
  name: "processProviderEvent",
  args: () => ProviderEventArgs,
  returns: () => ProviderEventReturn,
  error: () => NoRecoverableError,
});

const contractFunctions = [
  previewBroadcastContract,
  dispatchBroadcastContract,
] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make()
  .addFunction(subscribe)
  .addFunction(unsubscribe)
  .addFunction(previewBroadcast)
  .addFunction(sendTransactional)
  .addFunction(claimTransactional)
  .addFunction(recordTransactionalResult)
  .addFunction(prepareBroadcast)
  .addFunction(listCampaignRecipients)
  .addFunction(recordBroadcastResults)
  .addFunction(dispatchBroadcast)
  .addFunction(processProviderEvent);
