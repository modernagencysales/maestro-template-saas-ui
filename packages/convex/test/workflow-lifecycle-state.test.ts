import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { WorkflowRunRow } from "../confect/tables/workflowRuns";
import {
  MAX_ON_COMPLETE_CONTEXT_BYTES,
  WorkflowComponentCleanupState,
  WorkflowGenerationQuiescence,
  WorkflowLifecycleExecution,
  WorkflowProductCleanupState,
  createWorkflowLifecycleState,
  decodeWorkflowOnCompleteContext,
  deriveGenerationAnchor,
  transitionWorkflowLifecycle,
  type WorkflowLifecycleCommand,
  type WorkflowLifecycleState,
} from "../confect/workflows/_kit/lifecycleState";
import {
  initialWorkflowLifecycleFields,
  reserveWorkflowRun,
} from "../confect/workflows/_kit/ownership";
import { projectWorkflowStatus } from "../confect/workflows/_kit/status";
import { testConfectLayer } from "./support/confect";

const baseState = (overrides: Partial<WorkflowLifecycleState> = {}) =>
  createWorkflowLifecycleState({
    workspaceId: "workspace-a",
    workflowRunId: "run-a",
    workflowId: "workflow.invoice",
    workflowVersion: 3,
    generation: 0,
    retention: {
      parentUntil: 100,
      childUntil: 150,
      evidenceUntil: 175,
    },
    ...overrides,
  });

const command = (
  kind: WorkflowLifecycleCommand["kind"],
  extra: Record<string, unknown> = {},
): WorkflowLifecycleCommand =>
  ({
    kind,
    workspaceId: "workspace-a",
    workflowRunId: "run-a",
    generation: 0,
    ...extra,
  }) as WorkflowLifecycleCommand;

const apply = (
  state: WorkflowLifecycleState,
  next: WorkflowLifecycleCommand,
): WorkflowLifecycleState =>
  Result.getOrThrow(transitionWorkflowLifecycle(state, next));

describe("pure workflow lifecycle state", () => {
  it.each(["terminal", "canceled"] as const)(
    "completes the honest product cleanup path from %s execution",
    (execution) => {
      let state = baseState();
      state = apply(
        state,
        command(execution === "terminal" ? "mark-terminal" : "mark-canceled"),
      );
      expect(state).toMatchObject({
        execution,
        priorGenerationQuiescence: "pending",
      });
      state = apply(state, command("mark-generation-quiescent"));
      state = apply(state, command("request-cleanup", { now: 175 }));
      state = apply(state, command("begin-product-cleanup"));
      state = apply(state, command("request-component-cleanup"));
      state = apply(state, command("mark-component-known-work-complete"));
      state = apply(state, command("mark-product-cleaned"));
      expect(state).toMatchObject({
        cleanup: "product-cleaned",
        componentCleanup: "component-known-work-complete",
      });
    },
  );

  it("restarts only a quiescent terminal generation at a stable anchor", () => {
    let state = apply(baseState(), command("mark-terminal"));
    state = apply(state, command("mark-generation-quiescent"));
    state = apply(
      state,
      command("advance-generation", {
        nextGeneration: 1,
        restartAnchor: "review.v3",
      }),
    );
    expect(state).toMatchObject({
      execution: "active",
      generation: 1,
      generationAnchor: deriveGenerationAnchor("workflow.invoice", 3, 1),
      restartAnchor: "review.v3",
      priorGenerationQuiescence: "quiescent",
    });
  });

  it.each([
    [
      "wrong workspace",
      baseState(),
      command("mark-terminal", { workspaceId: "workspace-b" }),
      "ownership",
    ],
    [
      "wrong generation",
      baseState(),
      command("mark-terminal", { generation: 1 }),
      "generation",
    ],
    [
      "terminal regression",
      { ...baseState(), execution: "canceled" as const },
      command("mark-terminal"),
      "transition",
    ],
    [
      "active cleanup",
      baseState(),
      command("request-cleanup", { now: 500 }),
      "terminal or canceled",
    ],
    [
      "non-quiescent cleanup",
      { ...baseState(), execution: "terminal" as const },
      command("request-cleanup", { now: 500 }),
      "quiescence",
    ],
    [
      "retained child",
      {
        ...baseState(),
        execution: "terminal" as const,
        priorGenerationQuiescence: "quiescent" as const,
      },
      command("request-cleanup", { now: 149 }),
      "child retention",
    ],
    [
      "retained evidence",
      {
        ...baseState(),
        execution: "terminal" as const,
        priorGenerationQuiescence: "quiescent" as const,
      },
      command("request-cleanup", { now: 174 }),
      "evidence retention",
    ],
  ])("fails closed on %s", (_name, state, next, reason) => {
    const result = transitionWorkflowLifecycle(state, next);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure.reason).toContain(reason);
  });

  it("property-checks every command guard before transition logic", () => {
    const commands: readonly WorkflowLifecycleCommand[] = [
      command("mark-terminal"),
      command("mark-canceled"),
      command("mark-generation-quiescent"),
      command("request-cleanup", { now: 500 }),
      command("begin-product-cleanup"),
      command("request-component-cleanup"),
      command("mark-component-known-work-complete"),
      command("mark-component-residuals-unverifiable"),
      command("mark-product-cleaned"),
      command("advance-generation", {
        nextGeneration: 1,
        restartAnchor: "beginning",
      }),
    ];
    for (const next of commands) {
      expect(
        Result.isFailure(
          transitionWorkflowLifecycle(baseState(), {
            ...next,
            workspaceId: "other-workspace",
          }),
        ),
      ).toBe(true);
      expect(
        Result.isFailure(
          transitionWorkflowLifecycle(baseState(), {
            ...next,
            generation: 99,
          }),
        ),
      ).toBe(true);
    }
  });
});

describe("workflow lifecycle persistence leaves", () => {
  const legacyRow = {
    workspaceId: "workspace-a",
    workflowId: "workflow.invoice",
    workflowVersion: 3,
    graphJson: "{}",
    status: "running",
    idempotencyKey: "invoice-1",
    startedByUserId: "user-a",
    startedAt: 1,
    completedAt: null,
    failedAt: null,
    trustReceiptId: null,
  } as const;

  it("keeps legacy rows decodable and accepts nullable lifecycle fields", () => {
    expect(Schema.decodeUnknownSync(WorkflowRunRow)(legacyRow)).toEqual(
      legacyRow,
    );
    expect(() =>
      Schema.decodeUnknownSync(WorkflowRunRow)({
        ...legacyRow,
        lifecycleExecution: null,
        lifecycleGeneration: null,
        lifecycleGenerationAnchor: null,
        lifecycleRestartAnchor: null,
        priorGenerationQuiescence: null,
        cleanupState: null,
        componentCleanupState: null,
        parentRetentionUntil: null,
        childRetentionUntil: null,
        evidenceRetentionUntil: null,
        onCompleteContext: null,
      }),
    ).not.toThrow();
  });

  it("initializes new ownership rows without changing old start wrappers", () => {
    expect(
      initialWorkflowLifecycleFields({
        workspaceId: "workspace-a",
        workflowRunId: "pending",
        workflowId: "workflow.invoice",
        workflowVersion: 3,
      }),
    ).toMatchObject({
      lifecycleExecution: "active",
      lifecycleGeneration: 0,
      priorGenerationQuiescence: "not-applicable",
      cleanupState: "not-requested",
      componentCleanupState: "not-requested",
      componentResidualState: "not-assessed",
    });
  });

  it("persists initialized lifecycle fields after the canonical run ID exists", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const reservationId = yield* reserveWorkflowRun(writer, {
            workspaceId: "workspace-a",
            workflowId: "workflow.invoice",
            workflowVersion: 3,
            graphJson: "{}",
            idempotencyKey: "fixture",
            startedByUserId: "user-a",
            startedAt: 1,
          });
          const reader = yield* DatabaseReader;
          const row = yield* reader
            .table("workflowRuns")
            .index("by_idempotency_key", (q) =>
              q
                .eq("workspaceId", "workspace-a")
                .eq("idempotencyKey", "fixture"),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          return {
            reservationId: String(reservationId),
            storedId: String(row?._id ?? "missing"),
            lifecycleExecution: row?.lifecycleExecution ?? null,
            lifecycleGeneration: row?.lifecycleGeneration ?? null,
            lifecycleGenerationAnchor: row?.lifecycleGenerationAnchor ?? null,
            priorGenerationQuiescence: row?.priorGenerationQuiescence ?? null,
            cleanupState: row?.cleanupState ?? null,
            componentCleanupState: row?.componentCleanupState ?? null,
          };
        }),
        LifecycleInsertionSnapshot,
      );
    });

    const snapshot = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(snapshot).toEqual({
      reservationId: snapshot.storedId,
      storedId: snapshot.storedId,
      lifecycleExecution: "active",
      lifecycleGeneration: 0,
      lifecycleGenerationAnchor: deriveGenerationAnchor(
        "workflow.invoice",
        3,
        0,
      ),
      priorGenerationQuiescence: "not-applicable",
      cleanupState: "not-requested",
      componentCleanupState: "not-requested",
    });
  });

  it("projects lifecycle independently from component status", () => {
    expect(
      projectWorkflowStatus(
        { type: "canceled" },
        {
          status: "canceled",
          lifecycleExecution: "canceled",
          lifecycleGeneration: 2,
          priorGenerationQuiescence: "pending",
          cleanupState: "requested",
          componentCleanupState: "not-requested",
        },
      ),
    ).toMatchObject({
      status: "canceled",
      lifecycle: {
        execution: "canceled",
        generation: 2,
        priorGenerationQuiescence: "pending",
        cleanup: "requested",
        componentCleanup: "not-requested",
      },
    });
  });

  it("validates and bounds typed onComplete ownership context", () => {
    const valid = {
      workspaceId: "workspace-a",
      workflowRunId: "run-a",
      workflowId: "workflow.invoice",
      workflowVersion: 3,
      generation: 0,
      generationAnchor: deriveGenerationAnchor("workflow.invoice", 3, 0),
    };
    const decoded = decodeWorkflowOnCompleteContext(valid);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) expect(decoded.value).toEqual(valid);
    expect(
      Exit.isFailure(
        decodeWorkflowOnCompleteContext({
          ...valid,
          workspaceId: "x".repeat(MAX_ON_COMPLETE_CONTEXT_BYTES),
        }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
        decodeWorkflowOnCompleteContext({ ...valid, workflowVersion: -1 }),
      ),
    ).toBe(true);
  });
});

const LifecycleInsertionSnapshot = Schema.Struct({
  reservationId: Schema.String,
  storedId: Schema.String,
  lifecycleExecution: Schema.NullOr(WorkflowLifecycleExecution),
  lifecycleGeneration: Schema.NullOr(Schema.Number),
  lifecycleGenerationAnchor: Schema.NullOr(Schema.String),
  priorGenerationQuiescence: Schema.NullOr(WorkflowGenerationQuiescence),
  cleanupState: Schema.NullOr(WorkflowProductCleanupState),
  componentCleanupState: Schema.NullOr(WorkflowComponentCleanupState),
});
import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
