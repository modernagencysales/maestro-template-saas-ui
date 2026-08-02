import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import sourceGroundedBrief, {
  manifest as sourceGroundedBriefManifest,
  SourceGroundedBriefArgs,
  SourceGroundedBriefReturn,
} from "../confect/capabilities/sourceGroundedBrief.spec";
import sourceGroundedBriefImpl from "../confect/capabilities/sourceGroundedBrief.impl";
import { WorkspaceWriteErrors } from "../confect/capabilities/_kit/errors";
import {
  formatContextPackForBrief,
  normalizeSourceGroundedBriefInput,
} from "../confect/capabilities/sourceGroundedBrief.domain";
import { runFakeSourceGroundedBrief } from "../confect/capabilities/sourceGroundedBrief.fake";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { MemberNotInWorkspace, ValidationFailed } from "../confect/errors";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

const now = 1_782_924_800_000;

describe("sourceGroundedBrief capability contract", () => {
  it("declares args required by the first real capability", () => {
    expect(
      Schema.decodeUnknownSync(SourceGroundedBriefArgs)({
        workspaceId: "workspace_123",
        sourceIds: ["source_1", "source_2"],
        briefGoal: "Create a source-grounded implementation brief.",
        idempotencyKey: "brief-001",
      }),
    ).toEqual({
      workspaceId: "workspace_123",
      sourceIds: ["source_1", "source_2"],
      briefGoal: "Create a source-grounded implementation brief.",
      idempotencyKey: "brief-001",
    });
    expect(() =>
      Schema.decodeUnknownSync(SourceGroundedBriefArgs)({
        workspaceId: "workspace_123",
        sourceIds: [],
        briefGoal: "",
        idempotencyKey: "brief-001",
      }),
    ).toThrow();
  });

  it("declares return fields for provenance and trust", () => {
    expect(
      Schema.decodeUnknownSync(SourceGroundedBriefReturn)({
        briefMarkdown: "## Brief\n\n- Cited claim.",
        sourceTitles: ["Positioning Notes"],
        policySnapshotId: "policy_snapshot_123",
        modelReceiptId: "model_receipt_123",
        trustClaim: "source-backed-no-default-rag",
      }),
    ).toMatchObject({
      briefMarkdown: expect.stringContaining("Brief") as string,
      sourceTitles: ["Positioning Notes"],
      policySnapshotId: "policy_snapshot_123",
      modelReceiptId: "model_receipt_123",
      trustClaim: "source-backed-no-default-rag",
    });
  });

  it("uses the shared workspace write error family", () => {
    const runSpec = sourceGroundedBrief.functions.run;
    const runInternalSpec = sourceGroundedBrief.functions.runInternal;
    if (runSpec === undefined || runInternalSpec === undefined) {
      throw new Error(
        "Expected sourceGroundedBrief functions to be registered",
      );
    }
    const errorSchema = runSpec.functionProvenance.error;
    const internalErrorSchema = runInternalSpec.functionProvenance.error;
    if (errorSchema === undefined || internalErrorSchema === undefined) {
      throw new Error(
        "Expected sourceGroundedBrief functions to declare errors",
      );
    }

    const encoded = [
      new MemberNotInWorkspace({
        membershipId: "actor",
      }),
      new ValidationFailed({
        field: "sourceIds",
        message: "At least one source is required.",
      }),
    ].map((error) => Schema.encodeSync(WorkspaceWriteErrors)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "MemberNotInWorkspace",
      "ValidationFailed",
    ]);
    expect(
      Schema.encodeSync(errorSchema)(
        new ValidationFailed({
          field: "idempotencyKey",
          message: "Required for external writes.",
        }),
      ),
    ).toMatchObject({ _tag: "ValidationFailed" });
    expect(
      Schema.encodeSync(internalErrorSchema)(
        new MemberNotInWorkspace({
          membershipId: "actor",
        }),
      ),
    ).toMatchObject({ _tag: "MemberNotInWorkspace" });
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers public and internal Confect mutations", () => {
    expect(sourceGroundedBrief.functions.run).toMatchObject({
      name: "run",
      functionVisibility: "public",
      runtimeAndFunctionType: {
        functionType: "mutation",
      },
    });
    expect(sourceGroundedBrief.functions.runInternal).toMatchObject({
      name: "runInternal",
      functionVisibility: "internal",
      runtimeAndFunctionType: {
        functionType: "mutation",
      },
    });
  });

  it("does not advertise internal workflow steps as web-callable surfaces", () => {
    const runInternal = sourceGroundedBriefManifest.find(
      (entry) =>
        entry.operationId === "capabilities.sourceGroundedBrief.runInternal",
    );

    expect(runInternal).toMatchObject({
      surfaces: ["workflow", "internal"],
    });
  });

  it("normalizes input and formats source context deterministically", () => {
    const normalized = normalizeSourceGroundedBriefInput({
      workspaceId: " workspace_123 ",
      sourceIds: [" source_2 ", "source_1", "source_2"],
      briefGoal: "  Build an implementation brief. ",
      idempotencyKey: "brief-001",
    });

    expect(normalized).toEqual({
      workspaceId: "workspace_123",
      sourceIds: ["source_2", "source_1"],
      briefGoal: "Build an implementation brief.",
      idempotencyKey: "brief-001",
    });
    expect(
      formatContextPackForBrief([
        {
          id: "source_1",
          title: "Positioning Notes",
          markdown: "Trusted notes.",
        },
        {
          id: "source_2",
          title: "Homepage",
          markdown: "Trusted homepage copy.",
        },
      ]),
    ).toBe(
      "## Source: Positioning Notes\n\nTrusted notes.\n\n## Source: Homepage\n\nTrusted homepage copy.",
    );
  });

  it("runs deterministic fake LLM path without persisting workflow state", () => {
    expect(
      runFakeSourceGroundedBrief({
        input: {
          workspaceId: "workspace_123",
          sourceIds: ["source_1"],
          briefGoal: "Build an implementation brief.",
          idempotencyKey: "brief-001",
        },
        sources: [
          {
            id: "source_1",
            title: "Positioning Notes",
            markdown: "Trusted notes.",
          },
        ],
        policySnapshotId: "policy_snapshot_123",
        modelReceiptId: "model_receipt_123",
      }),
    ).toEqual({
      briefMarkdown:
        "## Source-Grounded Brief\n\nGoal: Build an implementation brief.\n\n### Sources\n\n- Positioning Notes\n\n### Draft\n\nThis deterministic fake brief is grounded in 1 approved source. Replace the fake LLM service before live use.",
      sourceTitles: ["Positioning Notes"],
      policySnapshotId: "policy_snapshot_123",
      modelReceiptId: "model_receipt_123",
      trustClaim: "source-backed-no-default-rag",
    });
  });

  it("exports a finalized Confect implementation", () => {
    expect(Layer.isLayer(sourceGroundedBriefImpl)).toBe(true);
  });

  it("rejects a workspace outsider before generating the public brief", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      return yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .mutation(refs.public.capabilities.sourceGroundedBrief.run, {
          workspaceId: seeded.workspaceId,
          sourceIds: ["source_1"],
          briefGoal: "Build an implementation brief.",
          idempotencyKey: "brief-001",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(MemberNotInWorkspace);
  });

  it("rejects padded idempotency keys with a typed validation error", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      return yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.capabilities.sourceGroundedBrief.run, {
          workspaceId: seeded.workspaceId,
          sourceIds: ["source_1"],
          briefGoal: "Build an implementation brief.",
          idempotencyKey: " brief-001 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });
});
