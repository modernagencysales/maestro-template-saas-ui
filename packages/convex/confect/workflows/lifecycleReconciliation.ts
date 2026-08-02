import type { GenericId } from "convex/values";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import {
  type WorkflowOnCompleteContext,
  type WorkflowLifecycleState,
} from "./_kit/lifecycleState";
import {
  decodeCompletionContext,
  planCompletionTransition,
} from "./_kit/completionReconciliation";
import {
  loadOwnedWorkflowRun,
  persistWorkflowLifecycleState,
  WorkflowLifecyclePersistenceError,
} from "./lifecyclePersistence";

type Reader = Context.Service.Shape<typeof DatabaseReader>;
type Writer = Context.Service.Shape<typeof DatabaseWriter>;

export type WorkflowCompletionResult =
  | { readonly kind: "success"; readonly returnValue: unknown }
  | { readonly kind: "failed"; readonly error: string }
  | { readonly kind: "canceled" };

export const reconcileWorkflowCompletion = (
  reader: Reader,
  writer: Writer,
  input: {
    readonly componentWorkflowId: string;
    readonly context: unknown;
    readonly result: WorkflowCompletionResult;
  },
) =>
  Effect.gen(function* () {
    const context = yield* decodeContext(input.context);
    const owned = yield* loadOwnedWorkflowRun(
      reader,
      context.workspaceId,
      context.workflowRunId,
    );
    if (
      owned === null ||
      owned.componentWorkflowId !== input.componentWorkflowId ||
      owned.state.workflowId !== context.workflowId ||
      owned.state.workflowVersion !== context.workflowVersion ||
      owned.state.generation !== context.generation ||
      owned.state.generationAnchor !== context.generationAnchor
    ) {
      return yield* unavailable("Completion ownership context does not match.");
    }
    const execution =
      input.result.kind === "canceled" ? "canceled" : "terminal";
    if (owned.state.execution !== "active") {
      const accepted = yield* acceptedCompletionKind(
        reader,
        owned.workflowRunId,
      );
      if (
        owned.state.execution !== execution ||
        accepted !== input.result.kind
      ) {
        return yield* unavailable(
          "Completion conflicts with the accepted terminal outcome.",
        );
      }
      return { status: accepted } as const;
    }
    const next = yield* transitionCompletion(owned.state, execution);
    yield* persistWorkflowLifecycleState(writer, owned.workflowRunId, next);
    yield* writer
      .table("workflowRuns")
      .patch(owned.workflowRunId as GenericId<"workflowRuns">, {
        status:
          input.result.kind === "success"
            ? "completed"
            : input.result.kind === "failed"
              ? "failed"
              : "canceled",
      })
      .pipe(Effect.orDie);
    return { status: input.result.kind } as const;
  });

const acceptedCompletionKind = (reader: Reader, workflowRunId: string) =>
  reader
    .table("workflowRuns")
    .get(workflowRunId as GenericId<"workflowRuns">)
    .pipe(
      Effect.orDie,
      Effect.flatMap((row) => {
        const accepted =
          row?.status === "completed"
            ? "success"
            : row?.status === "failed"
              ? "failed"
              : row?.status === "canceled"
                ? "canceled"
                : null;
        return accepted === null
          ? unavailable("Accepted completion outcome is unavailable.")
          : Effect.succeed(accepted);
      }),
    );

const decodeContext = (input: unknown) => {
  const decoded = decodeCompletionContext(input);
  return Result.isFailure(decoded)
    ? unavailable(decoded.failure)
    : Effect.succeed(decoded.success);
};

const transitionCompletion = (
  state: WorkflowLifecycleState,
  execution: "terminal" | "canceled",
) => {
  const result = planCompletionTransition(state, execution);
  return Result.isFailure(result)
    ? unavailable(result.failure)
    : Effect.succeed(result.success);
};

const unavailable = (message: string) =>
  Effect.fail(new WorkflowLifecyclePersistenceError({ message }));

export type { WorkflowOnCompleteContext };
