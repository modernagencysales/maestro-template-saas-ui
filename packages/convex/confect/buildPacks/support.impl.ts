import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { makeFunctionReference, type FunctionReference } from "convex/server";

import databaseSchema from "../_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "../_generated/services";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import supportGroup from "./support.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const runPackRef = makeFunctionReference<
  "action",
  { readonly packId: string },
  unknown
>("buildPacks/packs:runPack") as unknown as FunctionReference<
  "action",
  "internal",
  { readonly packId: string },
  unknown
>;

const resumeImpl = FunctionImpl.make(
  databaseSchema,
  supportGroup,
  "resume",
  ({ incidentId, operatorReason }) =>
    Effect.gen(function* () {
      const normalizedIncidentId = incidentId.trim();
      const normalizedReason = operatorReason.trim();
      if (!normalizedIncidentId)
        return yield* new ValidationFailed({
          field: "incidentId",
          message: "A support ID is required.",
        });
      if (normalizedReason.length < 10)
        return yield* new ValidationFailed({
          field: "operatorReason",
          message: "Record a specific operator reason before resuming.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const incident = yield* reader
        .table("supportIncidents")
        .index("by_incident", (q) => q.eq("incidentId", normalizedIncidentId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!incident)
        return yield* new NotFound({
          resource: "supportIncidents",
          id: normalizedIncidentId,
        });
      if (incident.status !== "needs-support")
        return yield* new ValidationFailed({
          field: "incidentId",
          message: "This support incident is not waiting for a resume.",
        });
      const pack = yield* reader
        .table("buildPacks")
        .index("by_pack", (q) => q.eq("packId", incident.packId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!pack)
        return yield* new NotFound({
          resource: "buildPacks",
          id: incident.packId,
        });
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_purchase", (q) => q.eq("purchaseId", incident.purchaseId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (entitlement?.status !== "active") return yield* new Unauthorized();
      const stage = yield* reader
        .table("buildPackStages")
        .index("by_pack_stage", (q) =>
          q.eq("packId", incident.packId).eq("stageName", incident.failedStage),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!stage)
        return yield* new NotFound({
          resource: "buildPackStages",
          id: `${incident.packId}:${incident.failedStage}`,
        });
      if (pack.status !== "needs-support" || stage.status !== "needs-support")
        return yield* new ValidationFailed({
          field: "incidentId",
          message: "The failed stage is no longer waiting for support.",
        });
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const attempt = stage.attempts + 1;
      yield* writer
        .table("buildPackStages")
        .patch(stage._id, {
          status: "running",
          attempts: attempt,
          errorCode: undefined,
          leaseId: undefined,
          leaseExpiresAt: undefined,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("buildPacks")
        .patch(pack._id, { status: "running", updatedAt: now })
        .pipe(Effect.orDie);
      yield* writer
        .table("supportIncidents")
        .patch(incident._id, {
          status: "resumed",
          operatorReason: normalizedReason,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      const ctx = yield* MutationCtx;
      yield* Effect.promise(() =>
        ctx.scheduler.runAfter(0, runPackRef, { packId: pack.packId }),
      ).pipe(Effect.orDie);
      return {
        incidentId: incident.incidentId,
        packId: pack.packId,
        failedStage: stage.stageName,
        attempt,
        status: "running" as const,
        operatorReason: normalizedReason,
      };
    }),
);

export default GroupImpl.make(databaseSchema, supportGroup).pipe(
  Layer.provide(resumeImpl),
  GroupImpl.finalize,
);
