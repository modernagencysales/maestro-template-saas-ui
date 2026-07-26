import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import {
  assertWorkflowAdmissionAvailable,
  reserveWorkflowRun,
} from "../confect/workflows/_kit/ownership";
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
});
