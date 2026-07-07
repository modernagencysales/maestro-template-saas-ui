import type { GenericId } from "convex/values";
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../_generated/schema";
import { requireWorkspaceAccess } from "./_kit/workspaceAccess";
import { runFakeSourceGroundedBrief } from "./sourceGroundedBrief.fake";
import { normalizeSourceGroundedBriefInput } from "./sourceGroundedBrief.domain";
import type { SourceGroundedBriefInput } from "./sourceGroundedBrief.domain";
import sourceGroundedBrief from "./sourceGroundedBrief.spec";

const unsafeAssumeClockProvided = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  // Confect provides Clock at runtime, but its current handler type omits it.
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const runSourceGroundedBrief = (input: SourceGroundedBriefInput) =>
  Effect.gen(function* () {
    yield* unsafeAssumeClockProvided(
      requireWorkspaceAccess(
        input.workspaceId as GenericId<"workspaces">,
        "editor",
      ),
    );

    const normalized = normalizeSourceGroundedBriefInput(input);
    if (normalized instanceof Error) {
      return yield* normalized;
    }

    return runFakeSourceGroundedBrief({
      input: normalized,
      sources: normalized.sourceIds.map((sourceId) => ({
        id: sourceId,
        title: `Source ${sourceId}`,
        markdown: "Synthetic source content for fake-mode capability run.",
      })),
      policySnapshotId: `policy_snapshot_${normalized.idempotencyKey}`,
      modelReceiptId: `model_receipt_${normalized.idempotencyKey}`,
    });
  });

const run = FunctionImpl.make(
  databaseSchema,
  sourceGroundedBrief,
  "run",
  runSourceGroundedBrief,
);

const runInternal = FunctionImpl.make(
  databaseSchema,
  sourceGroundedBrief,
  "runInternal",
  runSourceGroundedBrief,
);

export default GroupImpl.make(databaseSchema, sourceGroundedBrief).pipe(
  Layer.provide(run),
  Layer.provide(runInternal),
  GroupImpl.finalize,
);
