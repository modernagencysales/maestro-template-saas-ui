import { FunctionImpl, GroupImpl } from "@confect/server";
import { createPostmarkEmailProvider } from "@maestro-template/integrations";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "../_generated/services";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { loadEmailEnvConfig } from "../email/env";
import { createEmailUnsubscribeToken } from "../email/unsubscribeToken";
import { ValidationFailed, NotFound } from "../errors";
import { PublicBaseUrlConfig, RuntimeModeConfig } from "../shared/config";
import { validateCallerIdempotencyKey } from "../shared/idempotencyKey";
import { stableFingerprint } from "../shared/tokenCrypto";
import email from "./email.spec";

const MAX_BROADCAST_RECIPIENTS = 500;
const AUDIENCE_SCAN_LIMIT = MAX_BROADCAST_RECIPIENTS + 1;

const unsafeAssumeClockProvided = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const normalizeEmail = (value: string): string | null => {
  const email = value.trim().toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const activeSuppressions = (emailAddress: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("emailSuppressions")
      .index("by_email_active", (q) =>
        q.eq("email", emailAddress).eq("active", true),
      )
      .take(20)
      .pipe(Effect.orDie);
  });

const subscribe = FunctionImpl.make(
  databaseSchema,
  email,
  "subscribe",
  ({
    workspaceId,
    email: inputEmail,
    marketingOptIn,
    consentVersion,
    consentSource,
  }) =>
    Effect.gen(function* () {
      const access = yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "admin"),
      );
      if (!marketingOptIn) {
        return yield* new ValidationFailed({
          field: "marketingOptIn",
          message: "Marketing subscription requires explicit opt-in.",
        });
      }
      const emailAddress = normalizeEmail(inputEmail);
      if (emailAddress === null) {
        return yield* new ValidationFailed({
          field: "email",
          message: "Email address is invalid.",
        });
      }
      const suppressions = yield* activeSuppressions(emailAddress);
      const permanentSuppression = suppressions.find(
        (row) => row.reason !== "unsubscribe",
      );
      if (permanentSuppression !== undefined) {
        return yield* new ValidationFailed({
          field: "email",
          message: "This address cannot receive marketing email.",
        });
      }
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const existing = yield* reader
        .table("emailSubscribers")
        .index("by_workspace_email", (q) =>
          q.eq("workspaceId", workspaceId).eq("email", emailAddress),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);

      for (const suppression of suppressions) {
        yield* writer
          .table("emailSuppressions")
          .patch(suppression._id, { active: false, updatedAt: now })
          .pipe(Effect.orDie);
      }

      if (existing !== null) {
        yield* writer
          .table("emailSubscribers")
          .patch(existing._id, {
            recipientId: access.userId,
            status: "subscribed",
            consentVersion,
            consentSource,
            consentedAt: now,
            unsubscribedAt: undefined,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
        return {
          subscriberId: existing._id,
          workspaceId,
          email: emailAddress,
          status: "subscribed" as const,
          consentedAt: now,
        };
      }

      const subscriberId = yield* writer
        .table("emailSubscribers")
        .insert({
          workspaceId,
          recipientId: access.userId,
          email: emailAddress,
          status: "subscribed",
          consentVersion,
          consentSource,
          consentedAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return {
        subscriberId,
        workspaceId,
        email: emailAddress,
        status: "subscribed" as const,
        consentedAt: now,
      };
    }),
);

const upsertSuppression = (input: {
  readonly email: string;
  readonly reason:
    | "unsubscribe"
    | "hard_bounce"
    | "soft_bounce_limit"
    | "spam_complaint"
    | "subscription_change"
    | "operator";
  readonly source: string;
  readonly now: number;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existing = yield* reader
      .table("emailSuppressions")
      .index("by_email_active", (q) =>
        q.eq("email", input.email).eq("active", true),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (existing !== null) {
      yield* writer
        .table("emailSuppressions")
        .patch(existing._id, {
          reason: input.reason,
          source: input.source,
          updatedAt: input.now,
        })
        .pipe(Effect.orDie);
      return;
    }
    yield* writer
      .table("emailSuppressions")
      .insert({
        email: input.email,
        reason: input.reason,
        source: input.source,
        active: true,
        suppressedAt: input.now,
        updatedAt: input.now,
      })
      .pipe(Effect.orDie);
  });

const unsubscribe = FunctionImpl.make(
  databaseSchema,
  email,
  "unsubscribe",
  ({ subscriberId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const subscriber = yield* reader
        .table("emailSubscribers")
        .get(subscriberId)
        .pipe(Effect.orDie);
      if (subscriber === null) {
        return yield* new NotFound({
          resource: "emailSubscribers",
          id: subscriberId,
        });
      }
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      if (subscriber.status !== "unsubscribed") {
        yield* writer
          .table("emailSubscribers")
          .patch(subscriberId, {
            status: "unsubscribed",
            unsubscribedAt: now,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      yield* upsertSuppression({
        email: subscriber.email,
        reason: "unsubscribe",
        source: "one-click",
        now,
      });
      return {
        subscriberId,
        workspaceId: subscriber.workspaceId as GenericId<"workspaces">,
        email: subscriber.email,
        status: "unsubscribed" as const,
        consentedAt: subscriber.consentedAt,
        unsubscribedAt: subscriber.unsubscribedAt ?? now,
      };
    }),
);

const eligibleSubscribers = (workspaceId: GenericId<"workspaces">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const subscribers = yield* reader
      .table("emailSubscribers")
      .index("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "subscribed"),
      )
      .take(AUDIENCE_SCAN_LIMIT)
      .pipe(Effect.orDie);
    const eligible = [];
    for (const subscriber of subscribers) {
      const suppressions = yield* activeSuppressions(subscriber.email);
      if (suppressions.length === 0) eligible.push(subscriber);
    }
    return eligible;
  });

const previewBroadcast = FunctionImpl.make(
  databaseSchema,
  email,
  "previewBroadcast",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "admin"),
      );
      const subscribers = yield* eligibleSubscribers(workspaceId);
      return {
        eligibleRecipients: Math.min(
          subscribers.length,
          MAX_BROADCAST_RECIPIENTS,
        ),
        capped: subscribers.length > MAX_BROADCAST_RECIPIENTS,
      };
    }),
);

const claimTransactional = FunctionImpl.make(
  databaseSchema,
  email,
  "claimTransactional",
  (input) =>
    Effect.gen(function* () {
      const validated = validateCallerIdempotencyKey(input.idempotencyKey);
      if (!validated.ok) {
        return yield* new ValidationFailed({
          field: "idempotencyKey",
          message: validated.error.message,
        });
      }
      const emailAddress = normalizeEmail(input.to);
      if (emailAddress === null) {
        return yield* new ValidationFailed({
          field: "to",
          message: "Email address is invalid.",
        });
      }
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const existing = yield* reader
        .table("emailDeliveries")
        .index("by_idempotency", (q) =>
          q
            .eq("workspaceId", input.workspaceId)
            .eq("idempotencyKey", validated.value),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null) {
        const shouldSend = existing.status === "transient_failure";
        if (shouldSend) {
          yield* writer
            .table("emailDeliveries")
            .patch(existing._id, {
              status: "pending",
              attemptedAt: now,
              updatedAt: now,
            })
            .pipe(Effect.orDie);
        }
        return {
          deliveryId: existing._id,
          status: shouldSend ? ("pending" as const) : existing.status,
          shouldSend,
          ...(existing.providerMessageId === undefined
            ? {}
            : { providerMessageId: existing.providerMessageId }),
        };
      }
      const recipientHash = yield* Effect.promise(() =>
        stableFingerprint({ email: emailAddress }),
      );
      const deliveryId = yield* writer
        .table("emailDeliveries")
        .insert({
          workspaceId: input.workspaceId,
          ...(input.recipientId === undefined
            ? {}
            : { recipientId: input.recipientId }),
          recipientHash,
          kind: "transactional",
          idempotencyKey: validated.value,
          templateAlias: input.templateAlias,
          status: "pending",
          attemptedAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return {
        deliveryId,
        status: "pending" as const,
        shouldSend: true,
      };
    }),
);

const recordTransactionalResult = FunctionImpl.make(
  databaseSchema,
  email,
  "recordTransactionalResult",
  (input) =>
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("emailDeliveries")
        .patch(input.deliveryId, {
          status: input.status,
          ...(input.providerMessageId === undefined
            ? {}
            : { providerMessageId: input.providerMessageId }),
          ...(input.errorCode === undefined
            ? {}
            : { errorCode: input.errorCode }),
          ...(input.errorMessage === undefined
            ? {}
            : { errorMessage: input.errorMessage.slice(0, 300) }),
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return {
        deliveryId: input.deliveryId,
        status: input.status,
        ...(input.providerMessageId === undefined
          ? {}
          : { providerMessageId: input.providerMessageId }),
        retryable: input.status === "transient_failure",
      };
    }),
);

const sendTransactional = FunctionImpl.make(
  databaseSchema,
  email,
  "sendTransactional",
  (input) =>
    Effect.gen(function* () {
      const mutation = yield* MutationRunner;
      const claim = yield* mutation(
        refs.internal.ops.email.claimTransactional,
        input,
      ).pipe(
        Effect.catchTag(
          "SchemaError",
          () =>
            new ValidationFailed({
              field: "email",
              message: "Transactional email request is invalid.",
            }),
        ),
      );
      if (!claim.shouldSend) {
        return {
          deliveryId: claim.deliveryId,
          status: claim.status,
          ...(claim.providerMessageId === undefined
            ? {}
            : { providerMessageId: claim.providerMessageId }),
          retryable: false,
        };
      }
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.mapError(
          () =>
            new ValidationFailed({
              field: "email",
              message: "Email runtime mode is invalid.",
            }),
        ),
      );
      const env = yield* loadEmailEnvConfig.pipe(
        Effect.mapError(
          () =>
            new ValidationFailed({
              field: "email",
              message: "Email configuration is invalid.",
            }),
        ),
      );
      let result:
        | { status: "accepted"; providerMessageId: string }
        | {
            status: "transient_failure" | "permanent_failure";
            errorCode: number;
            errorMessage: string;
          };
      if (runtimeMode !== "live") {
        result = {
          status: "accepted",
          providerMessageId: `${runtimeMode}_${claim.deliveryId}`,
        };
      } else if (!env.POSTMARK_SERVER_TOKEN || !env.EMAIL_TRANSACTIONAL_FROM) {
        result = {
          status: "permanent_failure",
          errorCode: 422,
          errorMessage: "Transactional email is not configured.",
        };
      } else {
        try {
          const templateModel = JSON.parse(input.templateModelJson) as Record<
            string,
            unknown
          >;
          const provider = createPostmarkEmailProvider({
            token: env.POSTMARK_SERVER_TOKEN,
            transactionalFrom: env.EMAIL_TRANSACTIONAL_FROM,
            marketingFrom:
              env.EMAIL_MARKETING_FROM ?? env.EMAIL_TRANSACTIONAL_FROM,
            ...(env.EMAIL_REPLY_TO === undefined
              ? {}
              : { replyTo: env.EMAIL_REPLY_TO }),
          });
          const sent = yield* Effect.promise(() =>
            provider.sendTransactional({
              to: input.to,
              templateAlias: input.templateAlias,
              templateModel,
              idempotencyKey: input.idempotencyKey,
            }),
          );
          result = { status: "accepted", providerMessageId: sent.messageId };
        } catch (error) {
          const retryable =
            typeof error === "object" &&
            error !== null &&
            "retryable" in error &&
            error.retryable === true;
          result = {
            status: retryable ? "transient_failure" : "permanent_failure",
            errorCode:
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              typeof error.status === "number"
                ? error.status
                : 500,
            errorMessage: "Email provider rejected the request.",
          };
        }
      }
      return yield* mutation(
        refs.internal.ops.email.recordTransactionalResult,
        {
          deliveryId: claim.deliveryId,
          ...result,
        },
      ).pipe(Effect.orDie);
    }),
);

const prepareBroadcast = FunctionImpl.make(
  databaseSchema,
  email,
  "prepareBroadcast",
  (input) =>
    Effect.gen(function* () {
      const access = yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(input.workspaceId, "admin"),
      );
      const validated = validateCallerIdempotencyKey(input.idempotencyKey);
      if (!validated.ok) {
        return yield* new ValidationFailed({
          field: "idempotencyKey",
          message: validated.error.message,
        });
      }
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const existing = yield* reader
        .table("emailCampaigns")
        .index("by_idempotency", (q) =>
          q
            .eq("workspaceId", input.workspaceId)
            .eq("idempotencyKey", validated.value),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null) {
        return {
          campaignId: existing._id,
          eligibleRecipients: existing.recipientCount,
          capped: existing.recipientCount === MAX_BROADCAST_RECIPIENTS,
        };
      }
      const eligible = yield* eligibleSubscribers(input.workspaceId);
      const recipients = eligible.slice(0, MAX_BROADCAST_RECIPIENTS);
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const campaignId = yield* writer
        .table("emailCampaigns")
        .insert({
          workspaceId: input.workspaceId,
          createdByUserId: access.userId,
          idempotencyKey: validated.value,
          templateAlias: "simple-broadcast",
          subject: input.subject,
          preheader: input.preheader,
          textBody: input.textBody,
          htmlBody: input.htmlBody,
          status: "preparing",
          recipientCount: recipients.length,
          acceptedCount: 0,
          failedCount: 0,
          createdAt: now,
          createdAtDescending: -now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      for (const subscriber of recipients) {
        const recipientHash = yield* Effect.promise(() =>
          stableFingerprint({ email: subscriber.email }),
        );
        yield* writer
          .table("emailDeliveries")
          .insert({
            workspaceId: input.workspaceId,
            campaignId,
            subscriberId: subscriber._id,
            recipientHash,
            kind: "broadcast",
            idempotencyKey: `${campaignId}:${subscriber._id}`,
            templateAlias: "simple-broadcast",
            status: "pending",
            attemptedAt: now,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      yield* writer
        .table("emailCampaigns")
        .patch(campaignId, { status: "sending", updatedAt: now })
        .pipe(Effect.orDie);
      return {
        campaignId,
        eligibleRecipients: recipients.length,
        capped: eligible.length > MAX_BROADCAST_RECIPIENTS,
      };
    }),
);

const listCampaignRecipients = FunctionImpl.make(
  databaseSchema,
  email,
  "listCampaignRecipients",
  ({ campaignId }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const pending = yield* reader
        .table("emailDeliveries")
        .index("by_campaign_status", (q) =>
          q.eq("campaignId", campaignId).eq("status", "pending"),
        )
        .take(MAX_BROADCAST_RECIPIENTS)
        .pipe(Effect.orDie);
      const transient = yield* reader
        .table("emailDeliveries")
        .index("by_campaign_status", (q) =>
          q.eq("campaignId", campaignId).eq("status", "transient_failure"),
        )
        .take(MAX_BROADCAST_RECIPIENTS)
        .pipe(Effect.orDie);
      const deliveries = [...pending, ...transient].slice(
        0,
        MAX_BROADCAST_RECIPIENTS,
      );
      const recipients = [];
      for (const delivery of deliveries) {
        if (delivery.subscriberId === undefined) continue;
        const subscriberId =
          delivery.subscriberId as GenericId<"emailSubscribers">;
        const subscriber = yield* reader
          .table("emailSubscribers")
          .get(subscriberId)
          .pipe(Effect.orDie);
        if (subscriber === null) continue;
        const suppressions = yield* activeSuppressions(subscriber.email);
        recipients.push({
          subscriberId,
          email: subscriber.email,
          eligible:
            subscriber.status === "subscribed" && suppressions.length === 0,
        });
      }
      return recipients;
    }),
);

const recordBroadcastResults = FunctionImpl.make(
  databaseSchema,
  email,
  "recordBroadcastResults",
  ({ campaignId, results }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      for (const result of results) {
        const delivery = yield* reader
          .table("emailDeliveries")
          .index("by_campaign_subscriber", (q) =>
            q
              .eq("campaignId", campaignId)
              .eq("subscriberId", result.subscriberId),
          )
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (delivery === null) continue;
        yield* writer
          .table("emailDeliveries")
          .patch(delivery._id, {
            status: result.status,
            ...(result.providerMessageId === undefined
              ? {}
              : { providerMessageId: result.providerMessageId }),
            ...(result.errorCode === undefined
              ? {}
              : { errorCode: result.errorCode }),
            ...(result.errorMessage === undefined
              ? {}
              : { errorMessage: result.errorMessage.slice(0, 300) }),
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      const deliveries = yield* reader
        .table("emailDeliveries")
        .index("by_campaign_status", (q) => q.eq("campaignId", campaignId))
        .take(MAX_BROADCAST_RECIPIENTS)
        .pipe(Effect.orDie);
      const accepted = deliveries.filter(
        (row) => row.status === "accepted",
      ).length;
      const pendingOrTransient = deliveries.filter(
        (row) => row.status === "pending" || row.status === "transient_failure",
      ).length;
      const failed = deliveries.length - accepted;
      const status =
        pendingOrTransient > 0 || (accepted > 0 && failed > 0)
          ? ("partial" as const)
          : accepted === 0 && failed > 0
            ? ("failed" as const)
            : ("sent" as const);
      yield* writer
        .table("emailCampaigns")
        .patch(campaignId, {
          status,
          acceptedCount: accepted,
          failedCount: failed,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return {
        campaignId,
        eligibleRecipients: deliveries.length,
        accepted,
        failed,
        capped: deliveries.length === MAX_BROADCAST_RECIPIENTS,
      };
    }),
);

const dispatchBroadcast = FunctionImpl.make(
  databaseSchema,
  email,
  "dispatchBroadcast",
  (input) =>
    Effect.gen(function* () {
      const mutation = yield* MutationRunner;
      const query = yield* QueryRunner;
      const prepared = yield* mutation(
        refs.public.ops.email.prepareBroadcast,
        input,
      ).pipe(
        Effect.catchTag(
          "SchemaError",
          () =>
            new ValidationFailed({
              field: "email",
              message: "Broadcast request is invalid.",
            }),
        ),
      );
      const recipients = yield* query(
        refs.internal.ops.email.listCampaignRecipients,
        { campaignId: prepared.campaignId },
      ).pipe(Effect.orDie);
      if (recipients.length === 0) {
        return yield* mutation(refs.internal.ops.email.recordBroadcastResults, {
          campaignId: prepared.campaignId,
          results: [],
        }).pipe(Effect.orDie);
      }
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.mapError(
          () =>
            new ValidationFailed({
              field: "email",
              message: "Email runtime mode is invalid.",
            }),
        ),
      );
      const publicBaseUrl = yield* PublicBaseUrlConfig.pipe(
        Effect.mapError(
          () =>
            new ValidationFailed({
              field: "email",
              message: "Public email URL is invalid.",
            }),
        ),
      );
      const env = yield* loadEmailEnvConfig.pipe(
        Effect.mapError(
          () =>
            new ValidationFailed({
              field: "email",
              message: "Email configuration is invalid.",
            }),
        ),
      );
      const ineligible = recipients
        .filter((recipient) => !recipient.eligible)
        .map((recipient) => ({
          subscriberId: recipient.subscriberId,
          status: "permanent_failure" as const,
          errorCode: 406,
          errorMessage: "Recipient is unsubscribed or suppressed.",
        }));
      const eligible = recipients.filter((recipient) => recipient.eligible);
      let providerResults: Array<{
        subscriberId: GenericId<"emailSubscribers">;
        status: "accepted" | "transient_failure" | "permanent_failure";
        providerMessageId?: string;
        errorCode?: number;
        errorMessage?: string;
      }>;
      if (runtimeMode !== "live") {
        providerResults = eligible.map((recipient) => ({
          subscriberId: recipient.subscriberId,
          status: "accepted",
          providerMessageId: `${runtimeMode}_${prepared.campaignId}_${recipient.subscriberId}`,
        }));
      } else if (
        !env.POSTMARK_SERVER_TOKEN ||
        !env.EMAIL_TRANSACTIONAL_FROM ||
        !env.EMAIL_MARKETING_FROM ||
        !env.EMAIL_UNSUBSCRIBE_SECRET
      ) {
        providerResults = eligible.map((recipient) => ({
          subscriberId: recipient.subscriberId,
          status: "permanent_failure",
          errorCode: 422,
          errorMessage: "Broadcast email is not configured.",
        }));
      } else {
        const provider = createPostmarkEmailProvider({
          token: env.POSTMARK_SERVER_TOKEN,
          transactionalFrom: env.EMAIL_TRANSACTIONAL_FROM,
          marketingFrom: env.EMAIL_MARKETING_FROM,
          ...(env.EMAIL_REPLY_TO === undefined
            ? {}
            : { replyTo: env.EMAIL_REPLY_TO }),
        });
        const origin = new URL(publicBaseUrl).origin;
        const messages = yield* Effect.promise(() =>
          Promise.all(
            eligible.map(async (recipient) => ({
              recipientKey: recipient.subscriberId,
              to: recipient.email,
              templateAlias: "simple-broadcast",
              templateModel: {
                subject: input.subject,
                preheader: input.preheader,
                text_body: input.textBody,
                html_body: input.htmlBody,
              },
              campaignId: prepared.campaignId,
              unsubscribeUrl: `${origin}/email/unsubscribe?token=${encodeURIComponent(
                await createEmailUnsubscribeToken({
                  subscriberId: recipient.subscriberId,
                  secret: env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
                }),
              )}`,
            })),
          ),
        );
        try {
          const sent = yield* Effect.promise(() =>
            provider.sendBroadcast(messages),
          );
          providerResults = sent.map((result) =>
            result.status === "accepted"
              ? {
                  subscriberId:
                    result.recipientKey as GenericId<"emailSubscribers">,
                  status: "accepted" as const,
                  providerMessageId: result.messageId,
                }
              : {
                  subscriberId:
                    result.recipientKey as GenericId<"emailSubscribers">,
                  status: result.status,
                  errorCode: result.errorCode,
                  errorMessage: result.message,
                },
          );
        } catch (error) {
          const retryable =
            typeof error === "object" &&
            error !== null &&
            "retryable" in error &&
            error.retryable === true;
          providerResults = eligible.map((recipient) => ({
            subscriberId: recipient.subscriberId,
            status: retryable
              ? ("transient_failure" as const)
              : ("permanent_failure" as const),
            errorCode: 500,
            errorMessage: "Email provider rejected the broadcast.",
          }));
        }
      }
      return yield* mutation(refs.internal.ops.email.recordBroadcastResults, {
        campaignId: prepared.campaignId,
        results: [...ineligible, ...providerResults],
      }).pipe(Effect.orDie);
    }),
);

const processProviderEvent = FunctionImpl.make(
  databaseSchema,
  email,
  "processProviderEvent",
  (input) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const existing = yield* reader
        .table("emailEvents")
        .index("by_fingerprint", (q) => q.eq("fingerprint", input.fingerprint))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null) {
        return { status: "duplicate" as const, suppressed: false };
      }
      const emailAddress = normalizeEmail(input.recipient);
      if (emailAddress === null) {
        return { status: "processed" as const, suppressed: false };
      }
      const recipientHash = yield* Effect.promise(() =>
        stableFingerprint({ email: emailAddress }),
      );
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("emailEvents")
        .insert({
          fingerprint: input.fingerprint,
          kind: input.kind,
          recipientHash,
          ...(input.providerMessageId === undefined
            ? {}
            : { providerMessageId: input.providerMessageId }),
          receivedAt: now,
        })
        .pipe(Effect.orDie);
      let reason:
        | "hard_bounce"
        | "soft_bounce_limit"
        | "spam_complaint"
        | "subscription_change"
        | undefined;
      if (input.kind === "hard_bounce") reason = "hard_bounce";
      if (input.kind === "spam_complaint") reason = "spam_complaint";
      if (input.kind === "subscription_change") reason = "subscription_change";
      if (input.kind === "soft_bounce") {
        const softBounces = yield* reader
          .table("emailEvents")
          .index("by_recipient_kind", (q) =>
            q.eq("recipientHash", recipientHash).eq("kind", "soft_bounce"),
          )
          .take(3)
          .pipe(Effect.orDie);
        if (softBounces.length >= 3) reason = "soft_bounce_limit";
      }
      if (reason !== undefined) {
        yield* upsertSuppression({
          email: emailAddress,
          reason,
          source: "postmark-webhook",
          now,
        });
      }
      return {
        status: "processed" as const,
        suppressed: reason !== undefined,
      };
    }),
);

export default GroupImpl.make(databaseSchema, email).pipe(
  Layer.provide(subscribe),
  Layer.provide(unsubscribe),
  Layer.provide(previewBroadcast),
  Layer.provide(sendTransactional),
  Layer.provide(claimTransactional),
  Layer.provide(recordTransactionalResult),
  Layer.provide(prepareBroadcast),
  Layer.provide(listCampaignRecipients),
  Layer.provide(recordBroadcastResults),
  Layer.provide(dispatchBroadcast),
  Layer.provide(processProviderEvent),
  GroupImpl.finalize,
);
