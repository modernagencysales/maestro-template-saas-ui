import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import billingImpl from "../confect/ops/billing.impl";
import billing, {
  ApplyWebhookArgs,
  BillingError,
  BillingWebhookReturn,
  CheckSeatArgs,
  EntitlementReturn,
  GrantEntitlementArgs,
  RecordUsageArgs,
  SeatCheckReturn,
  UsageRecordReturn,
} from "../confect/ops/billing.spec";
import { MemberNotInWorkspace } from "../confect/errors";
import creditLedger from "../confect/tables/creditLedger";
import entitlements from "../confect/tables/entitlements";
import usageEvents from "../confect/tables/usageEvents";
import webhookEvents from "../confect/tables/webhookEvents";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

describe("billing Confect contracts", () => {
  it("declares entitlement, webhook, append-only ledger, and usage indexes", () => {
    expect(entitlements.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_feature: ["workspaceId", "featureKey"],
    });
    expect(webhookEvents.indexes).toMatchObject({
      by_provider_event: ["provider", "eventId", "signatureTimestamp"],
      by_dedupe_key: ["dedupeKey"],
      by_workspace_dedupe_key: ["workspaceId", "dedupeKey"],
      by_workspace: ["workspaceId"],
    });
    expect(creditLedger.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_idempotency: ["idempotencyKey"],
      by_workspace_idempotency: ["workspaceId", "idempotencyKey"],
      by_workspace_created: ["workspaceId", "createdAt"],
      by_append_only: ["workspaceId", "appendOnly"],
    });
    expect(usageEvents.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_idempotency: ["idempotencyKey"],
      by_workspace_idempotency: ["workspaceId", "idempotencyKey"],
      by_provider: ["provider"],
      by_entitlement: ["workspaceId", "entitlementKey"],
    });
  });

  it("validates usage, webhook, entitlement, and seat args with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(RecordUsageArgs)({
        workspaceId: "workspaces_123",
        idempotencyKey: "usage-001",
        provider: "openrouter",
        units: 10,
        costCredits: 2,
        entitlementKey: "llm_credits",
      }),
    ).toMatchObject({ entitlementKey: "llm_credits" });

    expect(
      Schema.decodeUnknownSync(ApplyWebhookArgs)({
        workspaceId: "workspace_123",
        provider: "dodo",
        eventId: "evt_123",
        eventType: "payment.succeeded",
        signatureTimestamp: "1700000000",
        dedupeKey: "dodo.evt_123.1700000000",
      }),
    ).toMatchObject({ dedupeKey: "dodo.evt_123.1700000000" });

    expect(
      Schema.decodeUnknownSync(GrantEntitlementArgs)({
        workspaceId: "workspace_123",
        entitlementKey: "seats",
        featureKey: "team_members",
        limit: 5,
        source: "dodo",
      }),
    ).toMatchObject({ limit: 5 });

    expect(
      Schema.decodeUnknownSync(CheckSeatArgs)({
        workspaceId: "workspace_123",
        currentSeats: 4,
        requestedSeats: 5,
        seatLimit: 5,
      }),
    ).toMatchObject({ requestedSeats: 5 });
  });

  it("declares billing return schemas for append-only ledger and idempotent webhooks", () => {
    expect(
      Schema.decodeUnknownSync(UsageRecordReturn)({
        workspaceId: "workspace_123",
        usageEventId: "usage_workspace_123_usage-001",
        ledgerEntryId: "ledger_workspace_123_usage-001",
        idempotencyKey: "usage-001",
        provider: "openrouter",
        units: 10,
        costCredits: 2,
        entitlementKey: "llm_credits",
        appendOnly: true,
        createdAt: 1,
      }),
    ).toMatchObject({ appendOnly: true });

    expect(
      Schema.decodeUnknownSync(BillingWebhookReturn)({
        workspaceId: "workspace_123",
        provider: "dodo",
        eventId: "evt_123",
        eventType: "payment.succeeded",
        signatureTimestamp: "1700000000",
        dedupeKey: "dodo.evt_123.1700000000",
        status: "processed",
        createdAt: 1,
      }),
    ).toMatchObject({ status: "processed" });

    expect(
      Schema.decodeUnknownSync(EntitlementReturn)({
        workspaceId: "workspace_123",
        entitlementKey: "seats",
        featureKey: "team_members",
        limit: 5,
        used: 0,
        source: "dodo",
        status: "active",
        createdAt: 1,
      }),
    ).toMatchObject({ status: "active" });

    expect(
      Schema.decodeUnknownSync(SeatCheckReturn)({
        workspaceId: "workspace_123",
        allowed: true,
        currentSeats: 4,
        requestedSeats: 5,
        seatLimit: 5,
      }),
    ).toMatchObject({ allowed: true });
  });

  it("declares public-safe typed billing failures", () => {
    const encoded = [
      new BillingError.DuplicateWebhook({
        dedupeKey: "dodo.evt_123.1700000000",
      }),
      new BillingError.InsufficientCredits({
        availableCredits: 1,
        requestedCredits: 2,
      }),
      new BillingError.SeatLimitExceeded({
        currentSeats: 4,
        requestedSeats: 6,
        seatLimit: 5,
      }),
      new MemberNotInWorkspace({
        membershipId: "actor",
      }),
      new BillingError.ValidationFailed({
        field: "idempotencyKey",
        message: "idempotencyKey is required.",
      }),
    ].map((error) => Schema.encodeSync(BillingError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "DuplicateWebhook",
      "InsufficientCredits",
      "SeatLimitExceeded",
      "MemberNotInWorkspace",
      "ValidationFailed",
    ]);
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers public Confect billing functions", () => {
    const serialized = JSON.stringify(billing);

    expect(serialized).toContain("recordUsage");
    expect(serialized).toContain("applyWebhook");
    expect(serialized).toContain("grantEntitlement");
    expect(serialized).toContain("checkSeat");
    expect(serialized).toContain("public");
  });

  it("exports a finalized fake/local Confect implementation", () => {
    expect(Layer.isLayer(billingImpl)).toBe(true);
  });

  it("rejects padded usage idempotency keys before writing ledger-shaped IDs", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_700_000_000_000),
        SeededTenancy,
      );
      return yield* confect
        .mutation(refs.public.ops.billing.recordUsage, {
          workspaceId: seeded.workspaceId,
          idempotencyKey: " usage-001 ",
          provider: "openrouter",
          units: 10,
          costCredits: 2,
          entitlementKey: "llm_credits",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(BillingError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("rejects padded webhook dedupe keys before recording webhook state", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.internal.ops.billing.applyWebhook, {
          workspaceId: "workspace_123",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.succeeded",
          signatureTimestamp: "1700000000",
          dedupeKey: " dodo.evt_123.1700000000 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(BillingError.ValidationFailed);
    expect(result).toMatchObject({
      field: "dedupeKey",
      message: "dedupeKey must not have leading or trailing whitespace.",
    });
  });

  it("persists billing webhooks and returns duplicate on exact replay", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const first = yield* confect.mutation(
        refs.internal.ops.billing.applyWebhook,
        {
          workspaceId: "workspace_webhook",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.succeeded",
          signatureTimestamp: "1700000000",
          dedupeKey: "dodo.evt_123.1700000000",
        },
      );
      const second = yield* confect.mutation(
        refs.internal.ops.billing.applyWebhook,
        {
          workspaceId: "workspace_webhook",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.succeeded",
          signatureTimestamp: "1700000000",
          dedupeKey: "dodo.evt_123.1700000000",
        },
      );
      const snapshot = yield* confect.run(
        readWebhookSnapshot({
          workspaceId: "workspace_webhook",
          dedupeKey: "dodo.evt_123.1700000000",
        }),
        WebhookSnapshot,
      );

      return { first, second, snapshot };
    });

    const { first, second, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(first).toMatchObject({
      workspaceId: "workspace_webhook",
      provider: "dodo",
      eventId: "evt_123",
      eventType: "payment.succeeded",
      signatureTimestamp: "1700000000",
      dedupeKey: "dodo.evt_123.1700000000",
      status: "processed",
      createdAt: 1_700_000_000_000,
    });
    expect(second).toEqual({
      ...first,
      status: "duplicate",
    });
    expect(snapshot).toEqual({
      count: 1,
      status: "processed",
      eventType: "payment.succeeded",
    });
  });

  it("rejects webhook dedupe-key reuse with a different payload", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      yield* confect.mutation(refs.internal.ops.billing.applyWebhook, {
        workspaceId: "workspace_webhook",
        provider: "dodo",
        eventId: "evt_123",
        eventType: "payment.succeeded",
        signatureTimestamp: "1700000000",
        dedupeKey: "dodo.evt_123.1700000000",
      });

      const error = yield* confect
        .mutation(refs.internal.ops.billing.applyWebhook, {
          workspaceId: "workspace_webhook",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.failed",
          signatureTimestamp: "1700000000",
          dedupeKey: "dodo.evt_123.1700000000",
        })
        .pipe(Effect.flip);
      const snapshot = yield* confect.run(
        readWebhookSnapshot({
          workspaceId: "workspace_webhook",
          dedupeKey: "dodo.evt_123.1700000000",
        }),
        WebhookSnapshot,
      );

      return { error, snapshot };
    });

    const { error, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(error).toBeInstanceOf(BillingError.ValidationFailed);
    expect(error).toMatchObject({
      field: "eventType",
      message:
        "dedupeKey was already used for a different billing webhook payload.",
    });
    expect(snapshot).toEqual({
      count: 1,
      status: "processed",
      eventType: "payment.succeeded",
    });
  });

  it("rejects provider webhook dedupe-key reuse across workspaces", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const first = yield* confect.mutation(
        refs.internal.ops.billing.applyWebhook,
        {
          workspaceId: "workspace_webhook_a",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.succeeded",
          signatureTimestamp: "1700000000",
          dedupeKey: "dodo.evt_123.1700000000",
        },
      );
      const error = yield* confect
        .mutation(refs.internal.ops.billing.applyWebhook, {
          workspaceId: "workspace_webhook_b",
          provider: "dodo",
          eventId: "evt_123",
          eventType: "payment.succeeded",
          signatureTimestamp: "1700000000",
          dedupeKey: "dodo.evt_123.1700000000",
        })
        .pipe(Effect.flip);
      const firstSnapshot = yield* confect.run(
        readWebhookSnapshot({
          workspaceId: "workspace_webhook_a",
          dedupeKey: "dodo.evt_123.1700000000",
        }),
        WebhookSnapshot,
      );
      const secondSnapshot = yield* confect.run(
        readWebhookSnapshot({
          workspaceId: "workspace_webhook_b",
          dedupeKey: "dodo.evt_123.1700000000",
        }),
        WebhookSnapshot,
      );

      return { first, error, firstSnapshot, secondSnapshot };
    });

    const { first, error, firstSnapshot, secondSnapshot } =
      await Effect.runPromise(program.pipe(Effect.provide(testConfectLayer())));

    expect(first.status).toBe("processed");
    expect(first.workspaceId).toBe("workspace_webhook_a");
    expect(error).toBeInstanceOf(BillingError.ValidationFailed);
    expect(error).toMatchObject({
      field: "workspaceId",
      message:
        "dedupeKey was already used for a different billing webhook payload.",
    });
    expect(firstSnapshot).toEqual({
      count: 1,
      status: "processed",
      eventType: "payment.succeeded",
    });
    expect(secondSnapshot).toEqual({ count: 0 });
  });

  it("records usage durably, debits the ledger, and increments active entitlement usage", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_700_000_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        seedEntitlement({
          workspaceId: seeded.workspaceId,
          entitlementKey: "llm_credits",
          limit: 10,
          used: 3,
          status: "active",
        }),
        SeedResult,
      );

      const result = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.ops.billing.recordUsage, {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-001",
          provider: "openrouter",
          units: 12,
          costCredits: 4,
          entitlementKey: "llm_credits",
        });
      const snapshot = yield* confect.run(
        readBillingUsageSnapshot({
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-001",
          entitlementKey: "llm_credits",
        }),
        BillingUsageSnapshot,
      );

      return { result, snapshot };
    });

    const { result, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toMatchObject({
      idempotencyKey: "usage-001",
      provider: "openrouter",
      units: 12,
      costCredits: 4,
      entitlementKey: "llm_credits",
      appendOnly: true,
      createdAt: 1_700_000_000_000,
    });
    expect(result.usageEventId).toEqual(expect.stringContaining("usageEvents"));
    expect(result.ledgerEntryId).toEqual(
      expect.stringContaining("creditLedger"),
    );
    expect(snapshot).toMatchObject({
      usageCount: 1,
      ledgerCount: 1,
      entitlementUsed: 7,
      ledgerType: "debit",
      ledgerReason: "llm_usage",
      ledgerCreatedBy: "system:billing",
    });
  });

  it("returns existing usage records idempotently without double-debiting credits", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_700_000_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        seedEntitlement({
          workspaceId: seeded.workspaceId,
          entitlementKey: "llm_credits",
          limit: 10,
          used: 0,
          status: "active",
        }),
        SeedResult,
      );

      const memberConfect = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      const first = yield* memberConfect.mutation(
        refs.public.ops.billing.recordUsage,
        {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-duplicate",
          provider: "openrouter",
          units: 12,
          costCredits: 4,
          entitlementKey: "llm_credits",
        },
      );
      const second = yield* memberConfect.mutation(
        refs.public.ops.billing.recordUsage,
        {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-duplicate",
          provider: "openrouter",
          units: 12,
          costCredits: 4,
          entitlementKey: "llm_credits",
        },
      );
      const snapshot = yield* confect.run(
        readBillingUsageSnapshot({
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-duplicate",
          entitlementKey: "llm_credits",
        }),
        BillingUsageSnapshot,
      );

      return { first, second, snapshot };
    });

    const { first, second, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(second).toEqual(first);
    expect(snapshot).toMatchObject({
      usageCount: 1,
      ledgerCount: 1,
      entitlementUsed: 4,
    });
  });

  it("rejects idempotency-key reuse with a different billing payload", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_700_000_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        seedEntitlement({
          workspaceId: seeded.workspaceId,
          entitlementKey: "llm_credits",
          limit: 10,
          used: 0,
          status: "active",
        }),
        SeedResult,
      );

      const memberConfect = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      yield* memberConfect.mutation(refs.public.ops.billing.recordUsage, {
        workspaceId: seeded.workspaceId,
        idempotencyKey: "usage-mismatch",
        provider: "openrouter",
        units: 12,
        costCredits: 4,
        entitlementKey: "llm_credits",
      });

      const error = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.ops.billing.recordUsage, {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-mismatch",
          provider: "email",
          units: 12,
          costCredits: 4,
          entitlementKey: "llm_credits",
        })
        .pipe(Effect.flip);
      const snapshot = yield* confect.run(
        readBillingUsageSnapshot({
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-mismatch",
          entitlementKey: "llm_credits",
        }),
        BillingUsageSnapshot,
      );

      return { error, snapshot };
    });

    const { error, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(error).toBeInstanceOf(BillingError.ValidationFailed);
    expect(error).toMatchObject({
      field: "provider",
      message:
        "idempotencyKey was already used for a different billing usage payload.",
    });
    expect(snapshot).toMatchObject({
      usageCount: 1,
      ledgerCount: 1,
      entitlementUsed: 4,
    });
  });

  it("rejects workspace outsiders before recording durable usage", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_700_000_000_000),
        SeededTenancy,
      );
      yield* confect.run(
        seedEntitlement({
          workspaceId: seeded.workspaceId,
          entitlementKey: "llm_credits",
          limit: 10,
          used: 0,
          status: "active",
        }),
        SeedResult,
      );

      const error = yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .mutation(refs.public.ops.billing.recordUsage, {
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-outsider",
          provider: "openrouter",
          units: 12,
          costCredits: 4,
          entitlementKey: "llm_credits",
        })
        .pipe(Effect.flip);
      const snapshot = yield* confect.run(
        readBillingUsageSnapshot({
          workspaceId: seeded.workspaceId,
          idempotencyKey: "usage-outsider",
          entitlementKey: "llm_credits",
        }),
        BillingUsageSnapshot,
      );

      return { error, snapshot };
    });

    const { error, snapshot } = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(error).toBeInstanceOf(MemberNotInWorkspace);
    expect(snapshot).toMatchObject({
      usageCount: 0,
      ledgerCount: 0,
      entitlementUsed: 0,
    });
  });

  it("rejects missing, paused, revoked, and over-limit entitlements before usage writes", async () => {
    const scenarios = [
      { name: "missing", status: null, availableCredits: 0 },
      { name: "paused", status: "paused" as const, availableCredits: 0 },
      { name: "revoked", status: "revoked" as const, availableCredits: 0 },
      { name: "over-limit", status: "active" as const, availableCredits: 1 },
    ];

    for (const scenario of scenarios) {
      const program = Effect.gen(function* () {
        const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
        const seeded = yield* confect.run(
          seedTenancy(1_700_000_000_000),
          SeededTenancy,
        );
        const workspaceId = seeded.workspaceId;
        const entitlementKey = "llm_credits";

        if (scenario.status !== null) {
          yield* confect.run(
            seedEntitlement({
              workspaceId,
              entitlementKey,
              limit: scenario.name === "over-limit" ? 5 : 10,
              used: scenario.name === "over-limit" ? 4 : 0,
              status: scenario.status,
            }),
            SeedResult,
          );
        }

        const error = yield* confect
          .withIdentity({
            subject: "member-subject",
            email: "member@example.com",
          })
          .mutation(refs.public.ops.billing.recordUsage, {
            workspaceId,
            idempotencyKey: `usage-${scenario.name}`,
            provider: "openrouter",
            units: 12,
            costCredits: 4,
            entitlementKey,
          })
          .pipe(Effect.flip);
        const snapshot = yield* confect.run(
          readBillingUsageSnapshot({
            workspaceId,
            idempotencyKey: `usage-${scenario.name}`,
            entitlementKey,
          }),
          BillingUsageSnapshot,
        );

        return { error, snapshot };
      });

      const { error, snapshot } = await Effect.runPromise(
        program.pipe(Effect.provide(testConfectLayer())),
      );

      expect(error).toBeInstanceOf(BillingError.InsufficientCredits);
      expect(error).toMatchObject({
        availableCredits: scenario.availableCredits,
        requestedCredits: 4,
      });
      expect(snapshot).toMatchObject({
        usageCount: 0,
        ledgerCount: 0,
      });
    }
  });
});

const seedEntitlement = (input: {
  readonly workspaceId: string;
  readonly entitlementKey: string;
  readonly limit: number;
  readonly used: number;
  readonly status: "active" | "paused" | "revoked";
}) =>
  Effect.gen(function* () {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("entitlements")
      .insert({
        workspaceId: input.workspaceId,
        entitlementKey: input.entitlementKey,
        featureKey: "llm_credits",
        limit: input.limit,
        used: input.used,
        source: "manual" as const,
        status: input.status,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      })
      .pipe(Effect.orDie);

    return { ok: true as const };
  });

const SeedResult = Schema.Struct({
  ok: Schema.Literal(true),
});

const BillingUsageSnapshot = Schema.Struct({
  usageCount: Schema.Number,
  ledgerCount: Schema.Number,
  entitlementUsed: Schema.optional(Schema.Number),
  ledgerType: Schema.optional(Schema.Literals(["credit", "debit"])),
  ledgerReason: Schema.optional(
    Schema.Literals([
      "manual_adjustment",
      "llm_usage",
      "seat_charge",
      "refund",
    ]),
  ),
  ledgerCreatedBy: Schema.optional(Schema.String),
});

const WebhookSnapshot = Schema.Struct({
  count: Schema.Number,
  status: Schema.optional(
    Schema.Literals(["processed", "duplicate", "failed"]),
  ),
  eventType: Schema.optional(Schema.String),
});

const readBillingUsageSnapshot = (input: {
  readonly workspaceId: string;
  readonly idempotencyKey: string;
  readonly entitlementKey: string;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const usageRows = yield* reader
      .table("usageEvents")
      .index("by_workspace_idempotency", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("idempotencyKey", input.idempotencyKey),
      )
      .collect()
      .pipe(Effect.orDie);
    const ledgerRows = yield* reader
      .table("creditLedger")
      .index("by_workspace_idempotency", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("idempotencyKey", input.idempotencyKey),
      )
      .collect()
      .pipe(Effect.orDie);
    const entitlement = yield* reader
      .table("entitlements")
      .index("by_workspace_entitlement", (q) =>
        q
          .eq("workspaceId", input.workspaceId)
          .eq("entitlementKey", input.entitlementKey),
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    const ledger = ledgerRows[0];

    return {
      usageCount: usageRows.length,
      ledgerCount: ledgerRows.length,
      ...(entitlement === null ? {} : { entitlementUsed: entitlement.used }),
      ...(ledger === undefined
        ? {}
        : {
            ledgerType: ledger.type,
            ledgerReason: ledger.reason,
            ledgerCreatedBy: ledger.createdBy,
          }),
    };
  });

const readWebhookSnapshot = (input: {
  readonly workspaceId: string;
  readonly dedupeKey: string;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const webhooks = yield* reader
      .table("webhookEvents")
      .index("by_workspace_dedupe_key", (q) =>
        q.eq("workspaceId", input.workspaceId).eq("dedupeKey", input.dedupeKey),
      )
      .collect()
      .pipe(Effect.orDie);
    const webhook = webhooks[0];

    return {
      count: webhooks.length,
      ...(webhook === undefined
        ? {}
        : {
            status: webhook.status,
            eventType: webhook.eventType,
          }),
    };
  });
