import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import email from "../confect/ops/email.spec";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import {
  BroadcastPreviewReturn,
  DispatchBroadcastArgs,
  SubscribeEmailArgs,
} from "../confect/ops/email.spec";
import emailCampaigns from "../confect/tables/emailCampaigns";
import emailDeliveries from "../confect/tables/emailDeliveries";
import emailEvents from "../confect/tables/emailEvents";
import emailSubscribers, {
  EmailSubscriberRow,
} from "../confect/tables/emailSubscribers";
import emailSuppressions from "../confect/tables/emailSuppressions";
import { ValidationFailed } from "../confect/errors";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

const promoteSeededMember = (input: {
  readonly workspaceId: string;
  readonly userId: string;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const membership = yield* reader
      .table("workspaceMembers")
      .index("by_workspace_user", (q) =>
        q.eq("workspaceId", input.workspaceId).eq("userId", input.userId),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (membership === null) return yield* Effect.die("Missing membership");
    yield* writer
      .table("workspaceMembers")
      .patch(membership._id, { role: "admin" })
      .pipe(Effect.orDie);
    return null;
  });

describe("email Confect contracts", () => {
  it("declares consent, suppression, campaign, delivery, and event indexes", () => {
    expect(emailSubscribers.indexes).toMatchObject({
      by_workspace_email: ["workspaceId", "email"],
      by_workspace_status: ["workspaceId", "status"],
      by_recipient: ["workspaceId", "recipientId"],
    });
    expect(emailSuppressions.indexes).toMatchObject({
      by_email: ["email"],
      by_email_active: ["email", "active"],
    });
    expect(emailCampaigns.indexes).toMatchObject({
      by_workspace_created: ["workspaceId", "createdAtDescending"],
      by_idempotency: ["workspaceId", "idempotencyKey"],
    });
    expect(emailDeliveries.indexes).toMatchObject({
      by_idempotency: ["workspaceId", "idempotencyKey"],
      by_campaign_status: ["campaignId", "status"],
      by_campaign_subscriber: ["campaignId", "subscriberId"],
    });
    expect(emailEvents.indexes).toMatchObject({
      by_fingerprint: ["fingerprint"],
      by_recipient_kind: ["recipientHash", "kind"],
    });
  });

  it("requires explicit consent evidence and validates headless broadcast args", () => {
    expect(
      Schema.decodeUnknownSync(SubscribeEmailArgs)({
        workspaceId: "workspaces_123",
        email: "Person@Example.com",
        marketingOptIn: true,
        consentVersion: "checkout-v1",
        consentSource: "offer-checkout",
      }),
    ).toMatchObject({ marketingOptIn: true });
    expect(() =>
      Schema.decodeUnknownSync(SubscribeEmailArgs)({
        workspaceId: "workspaces_123",
        email: "person@example.com",
        marketingOptIn: false,
        consentVersion: "checkout-v1",
        consentSource: "offer-checkout",
      }),
    ).not.toThrow();
    expect(
      Schema.decodeUnknownSync(DispatchBroadcastArgs)({
        workspaceId: "workspaces_123",
        idempotencyKey: "id-1",
        subject: "A useful update",
        preheader: "One short note.",
        textBody: "Hello.",
        htmlBody: "<p>Hello.</p>",
        confirmation: "SEND",
      }),
    ).toMatchObject({ confirmation: "SEND" });
    expect(
      Schema.decodeUnknownSync(BroadcastPreviewReturn)({
        eligibleRecipients: 12,
        capped: false,
      }),
    ).toEqual({ eligibleRecipients: 12, capped: false });
  });

  it("validates durable subscriber consent state and registers all operations", () => {
    expect(
      Schema.decodeUnknownSync(EmailSubscriberRow)({
        workspaceId: "workspaces_123",
        recipientId: "users_123",
        email: "person@example.com",
        status: "subscribed",
        consentVersion: "checkout-v1",
        consentSource: "offer-checkout",
        consentedAt: 1,
        updatedAt: 1,
      }),
    ).toMatchObject({ status: "subscribed" });
    const serialized = JSON.stringify(email);
    for (const name of [
      "subscribe",
      "unsubscribe",
      "previewBroadcast",
      "sendTransactional",
      "dispatchBroadcast",
      "processProviderEvent",
    ]) {
      expect(serialized).toContain(name);
    }
  });

  it("requires explicit opt-in and keeps unsubscribe idempotent and suppression-aware", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_785_648_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        promoteSeededMember({
          workspaceId: seeded.workspaceId,
          userId: seeded.memberUserId,
        }),
        Schema.Null,
      );
      const member = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      const rejected = yield* member
        .mutation(refs.public.ops.email.subscribe, {
          workspaceId: seeded.workspaceId,
          email: "Person@Example.com",
          marketingOptIn: false,
          consentVersion: "checkout-v1",
          consentSource: "offer-checkout",
        })
        .pipe(Effect.flip);
      const subscriber = yield* member.mutation(
        refs.public.ops.email.subscribe,
        {
          workspaceId: seeded.workspaceId,
          email: " Person@Example.com ",
          marketingOptIn: true,
          consentVersion: "checkout-v1",
          consentSource: "offer-checkout",
        },
      );
      const before = yield* member.query(
        refs.public.ops.email.previewBroadcast,
        {
          workspaceId: seeded.workspaceId,
        },
      );
      const first = yield* confect.mutation(
        refs.internal.ops.email.unsubscribe,
        {
          subscriberId: subscriber.subscriberId,
        },
      );
      const second = yield* confect.mutation(
        refs.internal.ops.email.unsubscribe,
        {
          subscriberId: subscriber.subscriberId,
        },
      );
      const after = yield* member.query(
        refs.public.ops.email.previewBroadcast,
        {
          workspaceId: seeded.workspaceId,
        },
      );
      const resubscribed = yield* member.mutation(
        refs.public.ops.email.subscribe,
        {
          workspaceId: seeded.workspaceId,
          email: "person@example.com",
          marketingOptIn: true,
          consentVersion: "checkout-v2",
          consentSource: "account-settings",
        },
      );
      return {
        rejected,
        subscriber,
        before,
        first,
        second,
        after,
        resubscribed,
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.rejected).toBeInstanceOf(ValidationFailed);
    expect(result.subscriber).toMatchObject({
      email: "person@example.com",
      status: "subscribed",
    });
    expect(result.before).toEqual({ eligibleRecipients: 1, capped: false });
    expect(result.first).toMatchObject({ status: "unsubscribed" });
    expect(result.second).toMatchObject({
      status: "unsubscribed",
      unsubscribedAt: result.first.unsubscribedAt,
    });
    expect(result.after).toEqual({ eligibleRecipients: 0, capped: false });
    expect(result.resubscribed).toMatchObject({ status: "subscribed" });
  });

  it("deduplicates transactional sends and snapshots a confirmed broadcast", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_785_648_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        promoteSeededMember({
          workspaceId: seeded.workspaceId,
          userId: seeded.memberUserId,
        }),
        Schema.Null,
      );
      const member = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      yield* member.mutation(refs.public.ops.email.subscribe, {
        workspaceId: seeded.workspaceId,
        email: "person@example.com",
        marketingOptIn: true,
        consentVersion: "checkout-v1",
        consentSource: "offer-checkout",
      });
      const transactionalInput = {
        workspaceId: seeded.workspaceId,
        recipientId: seeded.memberUserId,
        to: "member@example.com",
        templateAlias: "workspace-invitation",
        templateModelJson: JSON.stringify({ workspace_name: "Acme" }),
        idempotencyKey: "invitation.invitation-1",
      } as const;
      const first = yield* confect.action(
        refs.internal.ops.email.sendTransactional,
        transactionalInput,
      );
      const duplicate = yield* confect.action(
        refs.internal.ops.email.sendTransactional,
        transactionalInput,
      );
      const preview = yield* member.query(
        refs.public.ops.email.previewBroadcast,
        {
          workspaceId: seeded.workspaceId,
        },
      );
      const broadcast = yield* member.action(
        refs.public.ops.email.dispatchBroadcast,
        {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "id-1",
          subject: "A useful update",
          preheader: "One short note.",
          textBody: "Hello.",
          htmlBody: "<p>Hello.</p>",
          confirmation: "SEND",
        },
      );
      return { first, duplicate, preview, broadcast };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.first).toMatchObject({
      status: "accepted",
      retryable: false,
    });
    expect(result.duplicate).toMatchObject({
      deliveryId: result.first.deliveryId,
      status: "accepted",
      retryable: false,
    });
    expect(result.preview).toEqual({ eligibleRecipients: 1, capped: false });
    expect(result.broadcast).toMatchObject({
      eligibleRecipients: 1,
      accepted: 1,
      failed: 0,
    });
  });

  it("suppresses on hard bounce and after three distinct soft bounces", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      yield* confect.run(seedTenancy(1_785_648_000_000), SeededTenancy);
      const hard = yield* confect.mutation(
        refs.internal.ops.email.processProviderEvent,
        {
          fingerprint: "hard-1",
          kind: "hard_bounce",
          recipient: "hard@example.com",
        },
      );
      const duplicate = yield* confect.mutation(
        refs.internal.ops.email.processProviderEvent,
        {
          fingerprint: "hard-1",
          kind: "hard_bounce",
          recipient: "hard@example.com",
        },
      );
      const soft = [];
      for (const fingerprint of ["soft-1", "soft-2", "soft-3"]) {
        soft.push(
          yield* confect.mutation(
            refs.internal.ops.email.processProviderEvent,
            {
              fingerprint,
              kind: "soft_bounce",
              recipient: "soft@example.com",
            },
          ),
        );
      }
      return { hard, duplicate, soft };
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.hard).toEqual({ status: "processed", suppressed: true });
    expect(result.duplicate).toEqual({
      status: "duplicate",
      suppressed: false,
    });
    expect(result.soft.map((item) => item.suppressed)).toEqual([
      false,
      false,
      true,
    ]);
  });
});
