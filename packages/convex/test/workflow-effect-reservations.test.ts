import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
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
    expect(effectReservationsImpl).toMatchObject({ _op_layer: "Fold" });
  });

  it("atomically returns one dispatch decision for duplicate reservations", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
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
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
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
            strategy: "durable-ledger-and-reconcile",
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
