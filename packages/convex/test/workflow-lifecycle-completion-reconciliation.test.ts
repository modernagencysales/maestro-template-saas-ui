import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("../confect/workflows/_kit/ownership", async (importOriginal) => {
  const Effect = await import("effect/Effect");
  const original = await importOriginal<object>();
  return { ...original, transitionWorkflowAdmission: () => Effect.void };
});

import databaseSchema from "../confect/_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../confect/_generated/services";
import { reconcileWorkflowCompletion } from "../confect/workflows/lifecycleReconciliation";
import { testConfectLayer } from "./support/confect";
import { seedLifecyclePersistence } from "./workflow-lifecycle-persistence.fixture";

describe("workflow lifecycle completion exactly-once reconciliation", () => {
  it("accepts an identical replay and rejects a conflicting terminal retry", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      const seeded = yield* seedLifecyclePersistence(confect);
      return yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const writer = yield* DatabaseWriter;
          const context = {
            workspaceId: seeded.workspaceId,
            workflowRunId: seeded.runId,
            workflowId: "workflow.invoice-review",
            workflowVersion: 3,
            generation: 0,
            generationAnchor: "workflow.invoice-review@v3:g0",
          };
          const success = {
            componentWorkflowId: "component-run-a",
            context,
            result: { kind: "success" as const, returnValue: { ok: true } },
          };
          const accepted = yield* reconcileWorkflowCompletion(
            reader,
            writer,
            success,
          );
          const replay = yield* reconcileWorkflowCompletion(
            reader,
            writer,
            success,
          );
          const conflict = yield* reconcileWorkflowCompletion(reader, writer, {
            ...success,
            result: { kind: "failed" as const, error: "must-not-leak" },
          }).pipe(Effect.flip);
          const row = yield* reader
            .table("workflowRuns")
            .get(seeded.runId)
            .pipe(Effect.orDie);
          return JSON.stringify({
            accepted,
            replay,
            conflict: conflict.message,
            storedStatus: row?.status,
          });
        }),
        Schema.String,
      );
    });
    const result = JSON.parse(
      await Effect.runPromise(program.pipe(Effect.provide(testConfectLayer()))),
    );
    expect(result).toEqual({
      accepted: { status: "success" },
      replay: { status: "success" },
      conflict: "Completion conflicts with the accepted terminal outcome.",
      storedStatus: "completed",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });
});
