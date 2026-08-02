import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "../_generated/services";
import { sha256Hex } from "../shared/sha256";
import actions from "./actions.spec";

const now = 1_700_000_000_000;

// node:crypto is unavailable in the Convex isolate runtime.
const hashSecret = (value: string): string => `sha256:${sha256Hex(value)}`;
const urlSafeKeyPart = (value: string): string =>
  Array.from(value)
    .map((char) => {
      if (/^[A-Za-z0-9._-]$/.test(char)) {
        return char;
      }

      if (char === "~") {
        return "~~";
      }

      return `~${char.codePointAt(0)?.toString(16) ?? "0"}~`;
    })
    .join("");
const actionKey = (prefix: string, parts: readonly string[]): string =>
  [prefix, ...parts.map(urlSafeKeyPart)].join(".");

const enqueueAction = FunctionImpl.make(
  databaseSchema,
  actions,
  "enqueueAction",
  (input) =>
    Effect.succeed({
      jobId: `action_job_${input.workflowRunId}`,
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      capabilityId: input.capabilityId,
      targetKind: input.targetKind,
      targetRef: input.targetRef,
      payloadHash: input.payloadHash,
      approvalPolicyId: input.approvalPolicyId,
      safeModeExemptionReason: input.safeModeExemptionReason,
      status: input.approvalPolicyId
        ? ("waiting_for_approval" as const)
        : ("queued" as const),
      createdAt: now,
    }),
);

const approveAction = FunctionImpl.make(
  databaseSchema,
  actions,
  "approveAction",
  (input) =>
    Effect.succeed({
      approvalId: input.approvalId,
      workspaceId: input.workspaceId,
      jobId: `action_job_${input.approvalId}`,
      reviewerId: input.reviewerId,
      tokenHash: hashSecret(input.rawToken),
      scope: "action:approve" as const,
      status: "approved" as const,
      expiresAt: input.now + 86_400_000,
      createdAt: now,
      reviewedAt: input.now,
    }),
);

const configureTrigger = FunctionImpl.make(
  databaseSchema,
  actions,
  "configureTrigger",
  (input) =>
    Effect.succeed({
      triggerId: input.triggerId,
      workspaceId: input.workspaceId,
      actionKind: input.actionKind,
      schedule: input.schedule,
      capabilityId: input.capabilityId,
      configHash: input.configHash,
      enabled: input.enabled,
      idempotencyKey: actionKey("action-trigger", [
        input.workspaceId,
        input.triggerId,
        input.configHash,
      ]),
      createdAt: now,
    }),
);

const sendDigest = FunctionImpl.make(
  databaseSchema,
  actions,
  "sendDigest",
  (input) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const scheduler = yield* Scheduler;
      const workspaceId = input.workspaceId as GenericId<"workspaces">;
      const recipientId = input.recipientId as GenericId<"users">;
      const dedupeKey = actionKey("action-digest", [
        input.workspaceId,
        input.recipientId,
        String(input.periodStart),
        String(input.periodEnd),
      ]);
      const existing = yield* reader
        .table("actionDigests")
        .index("by_dedupe_key", (q) =>
          q.eq("workspaceId", input.workspaceId).eq("dedupeKey", dedupeKey),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const subject = `Action digest: ${input.jobsQueued} queued, ${input.approvalsWaiting} waiting, ${input.actionsPublished} published`;
      const body = `Your audited action queue has ${input.jobsQueued} queued jobs, ${input.approvalsWaiting} approvals waiting, and ${input.actionsPublished} published action.`;
      if (existing !== null) {
        return {
          digestId: existing.digestId,
          workspaceId: existing.workspaceId,
          recipientId: existing.recipientId,
          subject,
          body,
          dedupeKey: existing.dedupeKey,
          metadata: {
            providerMetadata: "[redacted]" as const,
            customerMetadata: "[redacted]" as const,
          },
          createdAt: existing.createdAt,
          ...(existing.sentAt === undefined ? {} : { sentAt: existing.sentAt }),
        };
      }
      const user = yield* reader
        .table("users")
        .get(recipientId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie,
        );
      const preference = yield* reader
        .table("notificationPreferences")
        .index("by_recipient_category", (q) =>
          q
            .eq("workspaceId", workspaceId)
            .eq("recipientId", recipientId)
            .eq("category", "system"),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const shouldSend = user !== null && (preference?.digest ?? true);
      const digestId = `digest_${input.workspaceId}_${input.recipientId}`;
      yield* writer
        .table("actionDigests")
        .insert({
          workspaceId: input.workspaceId,
          digestId,
          recipientId: input.recipientId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          jobsQueued: input.jobsQueued,
          approvalsWaiting: input.approvalsWaiting,
          actionsPublished: input.actionsPublished,
          dedupeKey,
          providerMetadataRedacted: "[redacted]",
          customerMetadataRedacted: "[redacted]",
          createdAt: now,
          ...(shouldSend ? { sentAt: now } : {}),
        })
        .pipe(Effect.orDie);
      if (shouldSend && user !== null) {
        yield* scheduler
          .runAfter(Duration.zero, refs.internal.ops.email.sendTransactional, {
            workspaceId,
            recipientId,
            to: user.email,
            templateAlias: "notification-digest",
            templateModelJson: JSON.stringify({
              subject,
              body,
              jobs_queued: input.jobsQueued,
              approvals_waiting: input.approvalsWaiting,
              actions_published: input.actionsPublished,
            }),
            idempotencyKey: dedupeKey,
          })
          .pipe(Effect.orDie);
      }
      return {
        digestId,
        workspaceId: input.workspaceId,
        recipientId: input.recipientId,
        subject,
        body,
        dedupeKey,
        metadata: {
          providerMetadata: "[redacted]" as const,
          customerMetadata: "[redacted]" as const,
        },
        createdAt: now,
        ...(shouldSend ? { sentAt: now } : {}),
      };
    }),
);

export default GroupImpl.make(databaseSchema, actions).pipe(
  Layer.provide(enqueueAction),
  Layer.provide(approveAction),
  Layer.provide(configureTrigger),
  Layer.provide(sendDigest),
  GroupImpl.finalize,
);
