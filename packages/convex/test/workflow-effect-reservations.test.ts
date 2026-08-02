import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import effectReservationsImpl from "../confect/workflows/effectReservations.impl";
import effectReservations from "../confect/workflows/effectReservations.spec";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

const now = 1_782_924_800_000;

describe("workflow effect reservation capabilities", () => {
  it("registers a finalized internal-only Confect group", () => {
    expect(JSON.stringify(effectReservations)).toContain("reserve");
    expect(JSON.stringify(effectReservations)).toContain("transition");
    expect(JSON.stringify(effectReservations)).toContain("history");
    expect(Layer.isLayer(effectReservationsImpl)).toBe(true);
  });

  it("atomically returns one dispatch decision for duplicate reservations", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const input = reserveInput(seeded.workspaceId);
      const reservations = yield* Effect.all(
        [
          confect.mutation(
            refs.internal.workflows.effectReservations.reserve,
            input,
          ),
          confect.mutation(
            refs.internal.workflows.effectReservations.reserve,
            input,
          ),
        ],
        { concurrency: "unbounded" },
      );
      const history = yield* confect.query(
        refs.internal.workflows.effectReservations.history,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          limit: 20,
        },
      );
      return { reservations, history };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(
      result.reservations.map(({ decision }) => decision.kind).sort(),
    ).toEqual(["dispatch", "in-flight"]);
    expect(result.reservations.every(({ state }) => state === "reserved")).toBe(
      true,
    );
    expect(result.history).toHaveLength(1);
  });

  it("appends ambiguity and reconciliation evidence without redispatch", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const input = reserveInput(seeded.workspaceId);
      yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        input,
      );
      yield* confect.mutation(
        refs.internal.workflows.effectReservations.transition,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          event: { kind: "submitted" },
          occurredAt: now + 1,
          providerCorrelationHash: "sha256:provider-1",
        },
      );
      const ambiguous = yield* confect.mutation(
        refs.internal.workflows.effectReservations.transition,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          event: {
            kind: "ambiguous",
            phase: "after-dispatch",
          },
          occurredAt: now + 2,
        },
      );
      const duplicate = yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        { ...input, occurredAt: now + 3 },
      );
      const history = yield* confect.query(
        refs.internal.workflows.effectReservations.history,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          limit: 20,
        },
      );
      return { ambiguous, duplicate, history };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.ambiguous).toMatchObject({
      state: "ambiguous",
      reconciliationState: "pending",
    });
    expect(result.duplicate.decision).toEqual({ kind: "reconcile" });
    expect(result.history.map(({ state }) => state)).toEqual([
      "reserved",
      "submitted",
      "ambiguous",
    ]);
    expect(result.history[2]).toMatchObject({
      providerCorrelationHash: "sha256:provider-1",
    });
    expect(JSON.stringify(result.history)).not.toContain("providerPayload");
  });

  it("routes a pre-dispatch ambiguity to reconciliation without provider dispatch", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const input = reserveInput(seeded.workspaceId);
      yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        input,
      );
      yield* confect.mutation(
        refs.internal.workflows.effectReservations.transition,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          event: { kind: "ambiguous", phase: "before-dispatch" },
          occurredAt: now + 1,
        },
      );
      return yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        { ...input, occurredAt: now + 2 },
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toMatchObject({
      state: "ambiguous",
      decision: { kind: "reconcile" },
    });
  });

  it("never reopens an unresolved effect after its dedupe horizon expires", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const input = reserveInput(seeded.workspaceId);
      yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        input,
      );
      return yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        { ...input, occurredAt: input.dedupeExpiresAt + 1 },
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toMatchObject({ decision: { kind: "manual-review" } });
  });

  it("deduplicates concurrent generations onto one logical effect", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const input = reserveInput(seeded.workspaceId);
      const first = yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        input,
      );
      const restarted = yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        { ...input, generation: 1, occurredAt: now + 1 },
      );
      const history = yield* confect.query(
        refs.internal.workflows.effectReservations.history,
        {
          workspaceId: seeded.workspaceId,
          logicalEffectKey: input.logicalEffectKey,
          limit: 20,
        },
      );
      return { first, restarted, history };
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.first.decision).toEqual({ kind: "dispatch" });
    expect(result.restarted.decision).toEqual({ kind: "in-flight" });
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.generation).toBe(0);
  });

  it("rejects a reservation whose dedupe horizon does not cover restart safety", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      return yield* confect.mutation(
        refs.internal.workflows.effectReservations.reserve,
        {
          ...reserveInput(seeded.workspaceId),
          dedupeExpiresAt: now + 9_999,
          restartSafeUntil: now + 10_000,
        },
      );
    });
    await expect(
      Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    ).rejects.toThrow(/cover the complete restart-safe window/);
  });
});

const reserveInput = <WorkspaceId extends string>(
  workspaceId: WorkspaceId,
) => ({
  workspaceId,
  workflowRunId: "run-1",
  workflowId: "workflow_publishBrief",
  workflowVersion: 2,
  generation: 0,
  stepName: "publish-brief.v2",
  logicalEffectKey: "effect.v1|11:workspace-1|5:run-1",
  capabilityRef: "capability.publishBrief.v2",
  effectClass: "external" as const,
  strategy: "durable-ledger-and-reconcile" as const,
  approvalCheck: "passed" as const,
  quotaRateCheck: "not-applicable" as const,
  spendKillSwitchCheck: "passed" as const,
  dedupeExpiresAt: now + 20_000,
  restartSafeUntil: now + 10_000,
  occurredAt: now,
});
