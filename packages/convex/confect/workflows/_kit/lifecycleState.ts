import { getConvexSize, v } from "convex/values";
import * as Data from "effect/Data";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { WorkflowStepName } from "./workflowReferences";

export const WorkflowLifecycleExecution = Schema.Literals([
  "active",
  "terminal",
  "canceled",
]);
export type WorkflowLifecycleExecution = Schema.Schema.Type<
  typeof WorkflowLifecycleExecution
>;

export const WorkflowGenerationQuiescence = Schema.Literals([
  "not-applicable",
  "pending",
  "quiescent",
]);
export type WorkflowGenerationQuiescence = Schema.Schema.Type<
  typeof WorkflowGenerationQuiescence
>;

export const WorkflowProductCleanupState = Schema.Literals([
  "not-requested",
  "requested",
  "in-progress",
  "product-cleaned",
]);
export type WorkflowProductCleanupState = Schema.Schema.Type<
  typeof WorkflowProductCleanupState
>;

export const WorkflowComponentCleanupState = Schema.Literals([
  "not-requested",
  "component-cleanup-requested",
  "component-known-work-complete",
  "component-residuals-unverifiable",
]);
export type WorkflowComponentCleanupState = Schema.Schema.Type<
  typeof WorkflowComponentCleanupState
>;

export const WorkflowComponentResidualState = Schema.Literals([
  "not-assessed",
  "component-residuals-unverifiable",
]);
export type WorkflowComponentResidualState = Schema.Schema.Type<
  typeof WorkflowComponentResidualState
>;

const NonNegativeInteger = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
);
export const WorkflowRetentionTime = Schema.NullOr(NonNegativeInteger);

export const WorkflowOnCompleteContext = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  workflowRunId: Schema.NonEmptyString,
  workflowId: Schema.NonEmptyString,
  workflowVersion: NonNegativeInteger,
  generation: NonNegativeInteger,
  generationAnchor: Schema.NonEmptyString,
});
export const WorkflowOnCompleteContextValidator = v.object({
  workspaceId: v.string(),
  workflowRunId: v.string(),
  workflowId: v.string(),
  workflowVersion: v.number(),
  generation: v.number(),
  generationAnchor: v.string(),
});
export type WorkflowOnCompleteContext = Schema.Schema.Type<
  typeof WorkflowOnCompleteContext
>;

/** Pinned Workpool completion-context ceiling; the context contains IDs only. */
export const MAX_ON_COMPLETE_CONTEXT_BYTES = 128 << 10;

export type WorkflowLifecycleState = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly execution: WorkflowLifecycleExecution;
  readonly generation: number;
  readonly generationAnchor: string;
  readonly restartAnchor:
    "beginning" | Schema.Schema.Type<typeof WorkflowStepName> | null;
  readonly priorGenerationQuiescence: WorkflowGenerationQuiescence;
  readonly cleanup: WorkflowProductCleanupState;
  readonly componentCleanup: WorkflowComponentCleanupState;
  readonly componentResiduals: WorkflowComponentResidualState;
  readonly retention: {
    readonly parentUntil: number | null;
    readonly childUntil: number | null;
    readonly evidenceUntil: number | null;
  };
};

type Guard = {
  readonly workspaceId: string;
  readonly workflowRunId: string;
  readonly generation: number;
};

export type WorkflowLifecycleCommand = Guard &
  (
    | { readonly kind: "mark-terminal" }
    | { readonly kind: "mark-canceled" }
    | { readonly kind: "mark-generation-quiescent" }
    | { readonly kind: "request-cleanup"; readonly now: number }
    | { readonly kind: "begin-product-cleanup" }
    | { readonly kind: "request-component-cleanup" }
    | { readonly kind: "mark-component-known-work-complete" }
    | { readonly kind: "mark-component-residuals-unverifiable" }
    | { readonly kind: "mark-product-cleaned" }
    | {
        readonly kind: "advance-generation";
        readonly nextGeneration: number;
        readonly restartAnchor:
          "beginning" | Schema.Schema.Type<typeof WorkflowStepName>;
      }
  );

export class WorkflowLifecycleTransitionError extends Data.TaggedError(
  "WorkflowLifecycleTransitionError",
)<{ readonly reason: string }> {}

export const deriveGenerationAnchor = (
  workflowId: string,
  workflowVersion: number,
  generation: number,
): string => `${workflowId}@v${workflowVersion}:g${generation}`;

export const createWorkflowLifecycleState = (
  input: {
    readonly workspaceId: string;
    readonly workflowRunId: string;
    readonly workflowId: string;
    readonly workflowVersion: number;
    readonly generation?: number;
    readonly retention?: Partial<WorkflowLifecycleState["retention"]>;
  } & Partial<
    Pick<
      WorkflowLifecycleState,
      | "execution"
      | "restartAnchor"
      | "priorGenerationQuiescence"
      | "cleanup"
      | "componentCleanup"
      | "componentResiduals"
    >
  >,
): WorkflowLifecycleState => {
  const generation = input.generation ?? 0;
  return {
    workspaceId: input.workspaceId,
    workflowRunId: input.workflowRunId,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    execution: input.execution ?? "active",
    generation,
    generationAnchor: deriveGenerationAnchor(
      input.workflowId,
      input.workflowVersion,
      generation,
    ),
    restartAnchor: input.restartAnchor ?? null,
    priorGenerationQuiescence:
      input.priorGenerationQuiescence ?? "not-applicable",
    cleanup: input.cleanup ?? "not-requested",
    componentCleanup: input.componentCleanup ?? "not-requested",
    componentResiduals: input.componentResiduals ?? "not-assessed",
    retention: {
      parentUntil: input.retention?.parentUntil ?? null,
      childUntil: input.retention?.childUntil ?? null,
      evidenceUntil: input.retention?.evidenceUntil ?? null,
    },
  };
};

export const decodeWorkflowOnCompleteContext = (
  input: unknown,
): Exit.Exit<
  WorkflowOnCompleteContext,
  Schema.SchemaError | WorkflowLifecycleTransitionError
> => {
  const decoded = Schema.decodeUnknownExit(WorkflowOnCompleteContext)(input);
  if (Exit.isFailure(decoded)) return decoded;
  if (getConvexSize(decoded.value) > MAX_ON_COMPLETE_CONTEXT_BYTES) {
    return Exit.fail(
      new WorkflowLifecycleTransitionError({
        reason:
          "onComplete context exceeds the bounded completion-context size",
      }),
    );
  }
  return decoded;
};

export const transitionWorkflowLifecycle = (
  state: WorkflowLifecycleState,
  command: WorkflowLifecycleCommand,
): Result.Result<WorkflowLifecycleState, WorkflowLifecycleTransitionError> => {
  const guardFinding = guardLifecycleTransition(state, command);
  if (guardFinding) return fail(guardFinding);
  switch (command.kind) {
    case "mark-terminal":
      return finishExecution(state, "terminal");
    case "mark-canceled":
      return finishExecution(state, "canceled");
    case "mark-generation-quiescent":
      return state.execution !== "active" &&
        state.priorGenerationQuiescence === "pending"
        ? Result.succeed({ ...state, priorGenerationQuiescence: "quiescent" })
        : fail(
            "generation can become quiescent only after terminal or canceled execution",
          );
    case "request-cleanup":
      return requestCleanup(state, command.now);
    case "begin-product-cleanup":
      return state.cleanup === "requested"
        ? Result.succeed({ ...state, cleanup: "in-progress" })
        : fail("product cleanup can begin only after cleanup is requested");
    case "request-component-cleanup":
      return state.cleanup === "in-progress" &&
        state.componentCleanup === "not-requested"
        ? Result.succeed({
            ...state,
            componentCleanup: "component-cleanup-requested",
          })
        : fail("component cleanup requires in-progress product cleanup");
    case "mark-component-known-work-complete":
      return state.componentCleanup === "component-cleanup-requested" ||
        state.componentCleanup === "component-residuals-unverifiable"
        ? Result.succeed({
            ...state,
            componentCleanup: "component-known-work-complete",
          })
        : fail(
            "known component work can complete only after cleanup is requested",
          );
    case "mark-component-residuals-unverifiable":
      return state.componentCleanup === "component-cleanup-requested" ||
        state.componentCleanup === "component-known-work-complete"
        ? Result.succeed({
            ...state,
            componentResiduals: "component-residuals-unverifiable",
          })
        : fail(
            "component residuals can be recorded only after cleanup is requested",
          );
    case "mark-product-cleaned":
      return state.cleanup === "in-progress" &&
        state.componentCleanup === "component-known-work-complete"
        ? Result.succeed({ ...state, cleanup: "product-cleaned" })
        : fail(
            "product-cleaned requires known component work completion without residuals",
          );
    case "advance-generation":
      return advanceGeneration(state, command);
  }
};

const guardLifecycleTransition = (
  state: WorkflowLifecycleState,
  command: WorkflowLifecycleCommand,
): string | undefined => {
  if (
    state.workspaceId !== command.workspaceId ||
    state.workflowRunId !== command.workflowRunId
  ) {
    return "workflow lifecycle ownership does not match";
  }
  if (state.generation !== command.generation) {
    return "workflow lifecycle generation does not match";
  }
  if (
    state.generationAnchor !==
    deriveGenerationAnchor(
      state.workflowId,
      state.workflowVersion,
      state.generation,
    )
  ) {
    return "workflow lifecycle generation anchor is invalid";
  }
  return undefined;
};

const finishExecution = (
  state: WorkflowLifecycleState,
  execution: "terminal" | "canceled",
) =>
  state.execution === "active" && state.cleanup === "not-requested"
    ? Result.succeed({
        ...state,
        execution,
        priorGenerationQuiescence: "pending" as const,
      })
    : fail("execution transition would be an impossible regression");

const requestCleanup = (state: WorkflowLifecycleState, now: number) => {
  if (state.execution === "active") {
    return fail("cleanup requires terminal or canceled execution");
  }
  if (state.priorGenerationQuiescence !== "quiescent") {
    return fail("cleanup requires prior generation quiescence");
  }
  if (state.cleanup !== "not-requested") {
    return fail("cleanup request would regress existing cleanup state");
  }
  if (!Number.isFinite(now) || now < 0) return fail("cleanup time is invalid");
  for (const [name, until] of Object.entries(state.retention)) {
    if (until !== null && now < until) {
      return fail(`${retentionName(name)} retention remains active`);
    }
  }
  return Result.succeed({ ...state, cleanup: "requested" as const });
};

const retentionName = (name: string): string =>
  name === "parentUntil"
    ? "parent"
    : name === "childUntil"
      ? "child"
      : "evidence";

const advanceGeneration = (
  state: WorkflowLifecycleState,
  command: Extract<WorkflowLifecycleCommand, { kind: "advance-generation" }>,
) => {
  if (
    state.execution === "active" ||
    state.priorGenerationQuiescence !== "quiescent" ||
    state.cleanup !== "not-requested"
  ) {
    return fail(
      "generation advance requires quiescent terminal or canceled execution",
    );
  }
  if (command.nextGeneration !== state.generation + 1) {
    return fail("next generation must advance exactly once");
  }
  try {
    if (command.restartAnchor !== "beginning") {
      Schema.decodeSync(WorkflowStepName)(command.restartAnchor);
    }
  } catch {
    return fail(
      "restart anchor must be beginning or a stable versioned step name",
    );
  }
  return Result.succeed({
    ...state,
    execution: "active" as const,
    generation: command.nextGeneration,
    generationAnchor: deriveGenerationAnchor(
      state.workflowId,
      state.workflowVersion,
      command.nextGeneration,
    ),
    restartAnchor: command.restartAnchor,
  });
};

const fail = (reason: string) =>
  Result.fail(new WorkflowLifecycleTransitionError({ reason }));
