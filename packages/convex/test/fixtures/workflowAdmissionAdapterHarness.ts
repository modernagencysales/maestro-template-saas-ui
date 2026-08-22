import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import { mutation } from "../../convex/_generated/server";
import {
  bindWorkflowAdmission,
  reserveWorkflowAdmission,
  transitionWorkflowAdmission,
} from "../../confect/workflows/_kit/ownership";

const emptyAdmissionReader = {
  table: () => ({
    index: () => ({ take: () => Effect.succeed([]) }),
  }),
} as unknown as Parameters<typeof reserveWorkflowAdmission>[1];

export const exercise = mutation({
  args: {},
  handler: async (ctx) => {
    const mutationContext = ctx as unknown as Parameters<
      typeof reserveWorkflowAdmission
    >[0];
    const policy = {
      user: { maxActive: 1, maxQueued: 1, retryAfterMs: 10 },
      system: { maxActive: 1, maxQueued: 1, retryAfterMs: 20 },
    } as const;
    const firstRunId = "adapter-run-one" as GenericId<"workflowRuns">;
    await Effect.runPromise(
      reserveWorkflowAdmission(mutationContext, emptyAdmissionReader, {
        workspaceId: "adapter-workspace",
        reservationKey: "adapter-one",
        lane: "user",
        policy,
      }),
    );
    await Effect.runPromise(
      bindWorkflowAdmission(
        mutationContext,
        "adapter-workspace",
        "adapter-one",
        firstRunId,
      ),
    );
    await Effect.runPromise(
      transitionWorkflowAdmission(mutationContext, firstRunId, "completed"),
    );
    await Effect.runPromise(
      reserveWorkflowAdmission(mutationContext, emptyAdmissionReader, {
        workspaceId: "adapter-workspace",
        reservationKey: "adapter-two",
        lane: "user",
        policy,
      }),
    );
    return "reserve-transition-release";
  },
});
