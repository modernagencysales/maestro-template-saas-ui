import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import {
  assertWorkflowAdmissionAvailable,
  handleExistingWorkflowRun,
  recordStartedWorkflow,
  reserveWorkflowRun,
  sameWorkflowStartBinding,
  workflowStartBindingHash,
} from "../confect/workflows/_kit/ownership";
import {
  createWorkflowSystemPrincipal,
  createWorkflowUserPrincipal,
} from "../confect/workflows/_kit/principal";
import {
  decideWorkflowAdmission,
  workflowAdmissionPolicy,
  type WorkflowAdmissionLane,
  type WorkflowAdmissionPolicy,
} from "../confect/workflows/_kit/workflowAdmission";
import { testConfectLayer } from "./support/confect";

const tinyPolicy: WorkflowAdmissionPolicy = {
  user: { maxActive: 1, maxQueued: 2, retryAfterMs: 10 },
  system: { maxActive: 1, maxQueued: 1, retryAfterMs: 20 },
};
const AdmissionIsolationResult = Schema.Struct({
  noisyDenied: Schema.Boolean,
  noisyLane: Schema.NullOr(Schema.String),
  quietAdmitted: Schema.Boolean,
  systemAdmitted: Schema.Boolean,
});
const SystemDenialResult = Schema.Struct({
  denied: Schema.Boolean,
  lane: Schema.NullOr(Schema.String),
  limit: Schema.NullOr(Schema.Number),
});

const systemPrincipal = createWorkflowSystemPrincipal({
  workspaceId: "workspace-a",
  systemId: "scheduler",
  reason: "scheduled fixture",
  grants: ["workflow:start"],
  kickoffAt: 1,
});
const systemPrincipalLater = createWorkflowSystemPrincipal({
  workspaceId: "workspace-a",
  systemId: "scheduler",
  reason: "scheduled fixture",
  grants: ["workflow:start"],
  kickoffAt: 999,
});
const userPrincipal = createWorkflowUserPrincipal({
  workspaceId: "workspace-a",
  actorId: "user-a",
  role: "admin",
  grants: ["workflow:start"],
  authEpoch: 1,
  kickoffAt: 1,
});

const startBindingInput = (overrides: Record<string, unknown> = {}) =>
  ({
    workflowRef: {} as FunctionReference<"mutation", "internal">,
    workflowArgs: { input: { alpha: 1, beta: 2 } },
    workspaceId: "workspace-a",
    workflowId: "workflow.fixture",
    workflowVersion: 1,
    graphJson: '{"nodes":[]}',
    idempotencyKey: "same-key",
    startedByUserId: "user-a",
    startedAt: 1,
    kickoffProfile: "queued" as const,
    principalSnapshot: userPrincipal,
    ...overrides,
  }) as Parameters<typeof workflowStartBindingHash>[0];

describe("workflow admission policy", () => {
  it("derives a narrow independent system lane", () => {
    expect(workflowAdmissionPolicy(20)).toEqual({
      user: { maxActive: 20, maxQueued: 80, retryAfterMs: 5_000 },
      system: { maxActive: 5, maxQueued: 10, retryAfterMs: 30_000 },
    });
  });

  it("reports active and queued saturation with retry guidance", () => {
    expect(
      decideWorkflowAdmission("user", { active: 1, queued: 0 }, tinyPolicy),
    ).toEqual({
      kind: "deny",
      lane: "user",
      saturated: "active",
      active: 1,
      queued: 0,
      limit: 1,
      retryAfterMs: 10,
    });
    expect(
      decideWorkflowAdmission("system", { active: 0, queued: 1 }, tinyPolicy),
    ).toMatchObject({ kind: "deny", lane: "system", saturated: "queued" });
  });
});

describe("workspace workflow admission", () => {
  const reserve = (
    workspaceId: string,
    idempotencyKey: string,
    admissionLane: WorkflowAdmissionLane,
  ) =>
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const runId = yield* reserveWorkflowRun(writer, {
        workspaceId,
        workflowId: "workflow.admission-fixture",
        workflowVersion: 1,
        graphJson: "{}",
        idempotencyKey,
        startedByUserId: "fixture",
        startedAt: 1,
        admissionLane,
      });
      return { writer, runId };
    });

  it("isolates a noisy workspace and the system lane", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      return yield* confect.run(
        Effect.gen(function* () {
          const { writer, runId } = yield* reserve(
            "workspace-noisy",
            "user-active",
            "user",
          );
          yield* writer
            .table("workflowRuns")
            .patch(runId, { status: "running" })
            .pipe(Effect.orDie);
          const reader = yield* DatabaseReader;
          const noisyUser = yield* Effect.either(
            assertWorkflowAdmissionAvailable(
              reader,
              "workspace-noisy",
              "user",
              tinyPolicy,
            ),
          );
          const quietUser = yield* Effect.either(
            assertWorkflowAdmissionAvailable(
              reader,
              "workspace-quiet",
              "user",
              tinyPolicy,
            ),
          );
          const noisySystem = yield* Effect.either(
            assertWorkflowAdmissionAvailable(
              reader,
              "workspace-noisy",
              "system",
              tinyPolicy,
            ),
          );
          return {
            noisyDenied: Either.isLeft(noisyUser),
            noisyLane: Either.isLeft(noisyUser) ? noisyUser.left.lane : null,
            quietAdmitted: Either.isRight(quietUser),
            systemAdmitted: Either.isRight(noisySystem),
          };
        }),
        AdmissionIsolationResult,
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toEqual({
      noisyDenied: true,
      noisyLane: "user",
      quietAdmitted: true,
      systemAdmitted: true,
    });
  });

  it("does not let system starts borrow user capacity", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      return yield* confect.run(
        Effect.gen(function* () {
          const { writer, runId } = yield* reserve(
            "workspace-a",
            "system-active",
            "system",
          );
          yield* writer
            .table("workflowRuns")
            .patch(runId, { status: "running" })
            .pipe(Effect.orDie);
          const reader = yield* DatabaseReader;
          const result = yield* Effect.either(
            assertWorkflowAdmissionAvailable(
              reader,
              "workspace-a",
              "system",
              tinyPolicy,
            ),
          );
          return {
            denied: Either.isLeft(result),
            lane: Either.isLeft(result) ? result.left.lane : null,
            limit: Either.isLeft(result) ? result.left.limit : null,
          };
        }),
        SystemDenialResult,
      );
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toEqual({ denied: true, lane: "system", limit: 1 });
  });

  it("denies the queued budget independently of active capacity", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* Effect.serviceOptional(
          TestConfect.TestConfect<typeof databaseSchema>(),
        );
        return yield* confect.run(
          Effect.gen(function* () {
            yield* reserve("workspace-queued-full", "queued-one", "user");
            yield* reserve("workspace-queued-full", "queued-two", "user");
            const reader = yield* DatabaseReader;
            const decision = yield* Effect.either(
              assertWorkflowAdmissionAvailable(
                reader,
                "workspace-queued-full",
                "user",
                tinyPolicy,
              ),
            );
            return Either.isLeft(decision)
              ? `${decision.left.saturated}:${decision.left.limit}`
              : "admitted";
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toBe("queued:2");
  });

  it("keeps queued starts queued until the first stage dispatch", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* Effect.serviceOptional(
          TestConfect.TestConfect<typeof databaseSchema>(),
        );
        return yield* confect.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const reader = yield* DatabaseReader;
            const runId = yield* reserveWorkflowRun(writer, {
              workspaceId: "workspace-queued",
              workflowId: "workflow.queued",
              workflowVersion: 1,
              graphJson: "{}",
              idempotencyKey: "queued-component",
              startedByUserId: "fixture",
              startedAt: 1,
              admissionLane: "user",
            });
            yield* recordStartedWorkflow(
              writer,
              runId,
              "component-queued" as never,
              "queued",
            );
            const row = yield* reader
              .table("workflowRuns")
              .get(runId)
              .pipe(Effect.orDie);
            return row?.status ?? "missing";
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toBe("queued");
  });

  it("derives the system lane from principal despite a user-lane hint", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const confect = yield* Effect.serviceOptional(
          TestConfect.TestConfect<typeof databaseSchema>(),
        );
        return yield* confect.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const reader = yield* DatabaseReader;
            const runId = yield* reserveWorkflowRun(writer, {
              workspaceId: "workspace-a",
              workflowId: "workflow.system",
              workflowVersion: 1,
              graphJson: "{}",
              idempotencyKey: "system-lane",
              startedByUserId: "scheduler",
              startedAt: 1,
              admissionLane: "user",
              principalSnapshot: systemPrincipal,
            });
            const row = yield* reader
              .table("workflowRunEvents")
              .index("by_run_type", (q) =>
                q
                  .eq("workflowRunId", runId)
                  .eq("type", "workflow.admission.reserved.v1"),
              )
              .first()
              .pipe(Effect.map(Option.getOrNull), Effect.orDie);
            return row === null
              ? "missing"
              : (JSON.parse(row.payloadJson) as { admissionLane: string })
                  .admissionLane;
          }),
          Schema.String,
        );
      }).pipe(Effect.provide(testConfectLayer())),
    );
    expect(result).toBe("system");
  });
});

describe("immutable workflow start binding", () => {
  it("ignores volatile principal and policy resolution timestamps", () => {
    const pinnedPolicy = {
      version: 1 as const,
      kind: "pinned" as const,
      schemaName: "workspace-policy",
      policyVersionId: "policy-v1",
      policyHash: "hash-v1",
      resolvedAt: 1,
    };
    const baseline = workflowStartBindingHash(
      startBindingInput({
        principalSnapshot: systemPrincipal,
        policySnapshot: pinnedPolicy,
      }),
      "same-key",
    );
    expect(
      workflowStartBindingHash(
        startBindingInput({
          principalSnapshot: systemPrincipalLater,
          policySnapshot: { ...pinnedPolicy, resolvedAt: 999 },
          startedAt: 999,
        }),
        "same-key",
      ),
    ).toBe(baseline);
  });

  it("returns the existing component for the same intent at a later time", async () => {
    const first = startBindingInput({ principalSnapshot: systemPrincipal });
    const later = startBindingInput({
      principalSnapshot: systemPrincipalLater,
      startedAt: 999,
    });
    const startBindingHash = workflowStartBindingHash(first, "same-key");
    await expect(
      Effect.runPromise(
        handleExistingWorkflowRun(
          {
            workflowId: first.workflowId,
            workflowVersion: first.workflowVersion,
            admissionLane: "system",
            startBindingHash,
            componentWorkflowId: "component-existing",
          },
          {
            ...later,
            admissionLane: "system",
            startBindingHash: workflowStartBindingHash(later, "same-key"),
          },
        ),
      ),
    ).resolves.toBe("component-existing");
  });

  it("binds version, arguments, principal, and derived lane", () => {
    const baseline = workflowStartBindingHash(startBindingInput(), "same-key");
    expect(
      workflowStartBindingHash(
        startBindingInput({ workflowVersion: 2 }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({ workflowArgs: { input: { alpha: 9, beta: 2 } } }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({ principalSnapshot: systemPrincipal }),
        "same-key",
      ),
    ).not.toBe(baseline);
    expect(
      workflowStartBindingHash(
        startBindingInput({
          policySnapshot: {
            version: 1,
            kind: "pinned",
            schemaName: "workspace-policy",
            policyVersionId: "policy-v2",
            policyHash: "hash-v2",
            resolvedAt: 1,
          },
        }),
        "same-key",
      ),
    ).not.toBe(baseline);
  });

  it("canonicalizes reordered object keys", () => {
    expect(workflowStartBindingHash(startBindingInput(), "same-key")).toBe(
      workflowStartBindingHash(
        startBindingInput({ workflowArgs: { input: { beta: 2, alpha: 1 } } }),
        "same-key",
      ),
    );
  });

  it("accepts exact replay and fails closed for mismatch or legacy rows", () => {
    const input = startBindingInput();
    const hash = workflowStartBindingHash(input, "same-key");
    const replay = {
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      admissionLane: "user" as const,
      startBindingHash: hash,
    };
    expect(
      sameWorkflowStartBinding(replay, { ...replay, startBindingHash: hash }),
    ).toBe(true);
    expect(
      sameWorkflowStartBinding(replay, {
        ...replay,
        startBindingHash: "different",
      }),
    ).toBe(false);
    expect(
      sameWorkflowStartBinding(
        { ...replay, startBindingHash: null },
        { ...replay, startBindingHash: hash },
      ),
    ).toBe(false);
  });
});
