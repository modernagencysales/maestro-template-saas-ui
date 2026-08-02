import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import transforms, {
  GetTransformRunArgs,
  ProjectTrustReceiptArgs,
  RegisterTransformDefinitionArgs,
  RunTransformArgs,
  TransformBlockReturn,
  TransformDefinitionReturn,
  TransformError,
  TransformRunReturn,
  TransformTrustReceiptReturn,
} from "../confect/ops/transforms.spec";
import transformsImpl from "../confect/ops/transforms.impl";
import transformBlocks from "../confect/tables/transformBlocks";
import transformDefinitions from "../confect/tables/transformDefinitions";
import transformRuns from "../confect/tables/transformRuns";
import { testConfectLayer } from "./support/confect";

describe("transform Confect contracts", () => {
  it("declares transform definition, run, and block tables", () => {
    expect(transformDefinitions.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_transform: ["workspaceId", "transformId"],
    });
    expect(transformRuns.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_transform: ["workspaceId", "transformId"],
      by_status: ["workspaceId", "status"],
    });
    expect(transformBlocks.indexes).toMatchObject({
      by_run: ["runId"],
      by_transform: ["workspaceId", "transformId"],
    });
  });

  it("validates register, run, get, and receipt args with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(RegisterTransformDefinitionArgs)({
        workspaceId: "workspace_123",
        transformId: "transform_gtm_brief",
        name: "GTM Brief",
        inputSchemaRef: "schema:context-pack:v1",
        outputSchemaRef: "schema:brief:v1",
        policyKind: "approval-required",
        requiredEvidence: ["sourceIds", "citationIds", "policySnapshotId"],
      }),
    ).toMatchObject({ policyKind: "approval-required" });

    expect(
      Schema.decodeUnknownSync(RunTransformArgs)({
        workspaceId: "workspace_123",
        runId: "run_001",
        transformId: "transform_gtm_brief",
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        policySnapshotId: "policy_snapshot_001",
        modelReceiptId: "model_receipt_001",
        idempotencyKey: "run-001",
      }),
    ).toMatchObject({ runId: "run_001" });

    expect(
      Schema.decodeUnknownSync(GetTransformRunArgs)({
        workspaceId: "workspace_123",
        runId: "run_001",
      }),
    ).toEqual({ workspaceId: "workspace_123", runId: "run_001" });

    expect(
      Schema.decodeUnknownSync(ProjectTrustReceiptArgs)({
        workspaceId: "workspace_123",
        runId: "run_001",
      }),
    ).toEqual({ workspaceId: "workspace_123", runId: "run_001" });
  });

  it("declares definition, run, block, and Trust Receipt return schemas", () => {
    expect(
      Schema.decodeUnknownSync(TransformDefinitionReturn)({
        workspaceId: "workspace_123",
        transformId: "transform_gtm_brief",
        name: "GTM Brief",
        inputSchemaRef: "schema:context-pack:v1",
        outputSchemaRef: "schema:brief:v1",
        policyKind: "approval-required",
        requiredEvidence: ["sourceIds", "citationIds"],
        createdAt: 1,
      }),
    ).toMatchObject({ inputSchemaRef: "schema:context-pack:v1" });

    expect(
      Schema.decodeUnknownSync(TransformRunReturn)({
        workspaceId: "workspace_123",
        runId: "run_001",
        transformId: "transform_gtm_brief",
        status: "completed",
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        policySnapshotId: "policy_snapshot_001",
        modelReceiptId: "model_receipt_001",
        idempotencyKey: "run-001",
        createdAt: 1,
        completedAt: 2,
      }),
    ).toMatchObject({ status: "completed" });

    expect(
      Schema.decodeUnknownSync(TransformBlockReturn)({
        workspaceId: "workspace_123",
        runId: "run_001",
        blockId: "block_001",
        transformId: "transform_gtm_brief",
        kind: "model-output",
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        policySnapshotId: "policy_snapshot_001",
        modelReceiptId: "model_receipt_001",
        createdAt: 1,
      }),
    ).toMatchObject({ kind: "model-output" });

    expect(
      Schema.decodeUnknownSync(TransformTrustReceiptReturn)({
        receiptId: "trust_transform_run_001",
        workspaceId: "workspace_123",
        runId: "run_001",
        transformId: "transform_gtm_brief",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        inputHashes: ["sha256:input"],
        outputHashes: ["sha256:output"],
        policySnapshotIds: ["policy_snapshot_001"],
        modelReceiptIds: ["model_receipt_001"],
        trustClaim: "source-backed-transform",
        createdAt: 1,
      }),
    ).toMatchObject({ trustClaim: "source-backed-transform" });
  });

  it("declares public-safe typed errors", () => {
    const encoded = [
      new TransformError.DefinitionNotFound({
        transformId: "transform_missing",
      }),
      new TransformError.RunNotFound({ runId: "run_missing" }),
      new TransformError.ValidationFailed({
        field: "inputHash",
        message: "inputHash is required.",
      }),
    ].map((error) => Schema.encodeSync(TransformError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "DefinitionNotFound",
      "RunNotFound",
      "ValidationFailed",
    ]);
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers public Confect transform functions", () => {
    const serialized = JSON.stringify(transforms);

    expect(serialized).toContain("registerDefinition");
    expect(serialized).toContain("runTransform");
    expect(serialized).toContain("getRun");
    expect(serialized).toContain("projectTrustReceipt");
    expect(serialized).toContain("public");
  });

  it("exports a finalized fake/local Confect implementation", () => {
    expect(Layer.isLayer(transformsImpl)).toBe(true);
  });

  it("rejects padded run idempotency keys before creating transform runs", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.transforms.runTransform, {
          workspaceId: "workspace_123",
          runId: "run_001",
          transformId: "transform_gtm_brief",
          inputHash: "sha256:input",
          outputHash: "sha256:output",
          sourceIds: ["source_founder_notes"],
          citationIds: ["citation_001"],
          policySnapshotId: "policy_snapshot_001",
          modelReceiptId: "model_receipt_001",
          idempotencyKey: " run-001 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(TransformError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });
});
