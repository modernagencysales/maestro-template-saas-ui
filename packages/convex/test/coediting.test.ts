import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import coediting, {
  AppendVersionArgs,
  CoeditingError,
  CreateAnnotationArgs,
  CreateDocumentArgs,
  DocumentAnnotationReturn,
  DocumentReturn,
  DocumentVersionReturn,
  ListDocumentsArgs,
} from "../confect/ops/coediting.spec";
import coeditingImpl from "../confect/ops/coediting.impl";
import documentAnnotations from "../confect/tables/documentAnnotations";
import documentVersions from "../confect/tables/documentVersions";
import documents from "../confect/tables/documents";
import { testConfectLayer } from "./support/confect";

describe("coediting Confect contracts", () => {
  it("declares workspace-owned document tables with stable indexes", () => {
    expect(documents.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_slug: ["workspaceId", "slug"],
    });
    expect(documentVersions.indexes).toMatchObject({
      by_document: ["documentId"],
      by_document_version: ["documentId", "versionId"],
    });
    expect(documentAnnotations.indexes).toMatchObject({
      by_document: ["documentId"],
      by_document_status: ["documentId", "status"],
      by_workspace: ["workspaceId"],
    });
  });

  it("validates list and create document args with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(ListDocumentsArgs)({
        workspaceId: "workspace_123",
      }),
    ).toEqual({ workspaceId: "workspace_123" });
    expect(
      Schema.decodeUnknownSync(CreateDocumentArgs)({
        workspaceId: "workspace_123",
        slug: "founder-notes",
        title: "Founder notes",
        markdown: "# Founder notes",
        sourceKind: "markdown",
        sourceIds: ["source_001"],
        authorId: "user_123",
        idempotencyKey: "document-001",
      }),
    ).toMatchObject({
      workspaceId: "workspace_123",
      slug: "founder-notes",
      sourceKind: "markdown",
    });
    expect(() =>
      Schema.decodeUnknownSync(CreateDocumentArgs)({
        workspaceId: "workspace_123",
        slug: "",
        title: "",
        markdown: "",
        sourceKind: "markdown",
        sourceIds: [],
        authorId: "",
        idempotencyKey: "",
      }),
    ).toThrow();
  });

  it("validates append version and annotation args", () => {
    expect(
      Schema.decodeUnknownSync(AppendVersionArgs)({
        workspaceId: "workspace_123",
        documentId: "document_123",
        versionId: "version_002",
        priorVersionId: "version_001",
        markdown: "# Updated notes",
        author: { type: "agent", id: "planner_agent" },
        sourceMetadata: {
          kind: "markdown",
          title: "Founder notes",
          sourceIds: ["source_001"],
        },
        idempotencyKey: "version-002",
      }),
    ).toMatchObject({
      documentId: "document_123",
      priorVersionId: "version_001",
      author: { type: "agent" },
    });
    expect(
      Schema.decodeUnknownSync(CreateAnnotationArgs)({
        workspaceId: "workspace_123",
        documentId: "document_123",
        versionId: "version_002",
        startOffset: 4,
        endOffset: 20,
        quotedText: "Updated notes",
        author: { type: "human", id: "user_123" },
        body: "Needs citation.",
        idempotencyKey: "annotation-001",
      }),
    ).toMatchObject({
      documentId: "document_123",
      startOffset: 4,
    });
  });

  it("declares return schemas for documents, versions, and annotations", () => {
    expect(
      Schema.decodeUnknownSync(DocumentReturn)({
        documentId: "document_123",
        workspaceId: "workspace_123",
        slug: "founder-notes",
        title: "Founder notes",
        latestVersionId: "version_001",
        sourceKind: "markdown",
        sourceIds: ["source_001"],
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toMatchObject({ latestVersionId: "version_001" });
    expect(
      Schema.decodeUnknownSync(DocumentVersionReturn)({
        documentId: "document_123",
        workspaceId: "workspace_123",
        versionId: "version_002",
        priorVersionId: "version_001",
        markdown: "# Updated notes",
        author: { type: "agent", id: "planner_agent" },
        createdAt: 2,
      }),
    ).toMatchObject({ versionId: "version_002" });
    expect(
      Schema.decodeUnknownSync(DocumentAnnotationReturn)({
        annotationId: "annotation_001",
        documentId: "document_123",
        workspaceId: "workspace_123",
        versionId: "version_002",
        startOffset: 4,
        endOffset: 20,
        quotedText: "Updated notes",
        author: { type: "human", id: "user_123" },
        body: "Needs citation.",
        status: "open",
        createdAt: 3,
      }),
    ).toMatchObject({ status: "open" });
  });

  it("declares public-safe typed errors", () => {
    const encoded = [
      new CoeditingError.WorkspaceNotFound({ workspaceId: "workspace_123" }),
      new CoeditingError.DocumentNotFound({ documentId: "document_123" }),
      new CoeditingError.VersionConflict({
        documentId: "document_123",
        priorVersionId: "version_old",
      }),
      new CoeditingError.ValidationFailed({
        field: "slug",
        message: "Slug is required.",
      }),
    ].map((error) => Schema.encodeSync(CoeditingError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "WorkspaceNotFound",
      "DocumentNotFound",
      "VersionConflict",
      "ValidationFailed",
    ]);
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers list/create/version/annotation public Confect functions", () => {
    const serialized = JSON.stringify(coediting);

    expect(serialized).toContain("listDocuments");
    expect(serialized).toContain("createDocument");
    expect(serialized).toContain("appendVersion");
    expect(serialized).toContain("createAnnotation");
    expect(serialized).toContain("public");
  });

  it("exports a finalized fake/local Confect implementation", () => {
    expect(Layer.isLayer(coeditingImpl)).toBe(true);
  });

  it("rejects padded create-document idempotency keys before deriving document ids", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.coediting.createDocument, {
          workspaceId: "workspace_123",
          slug: "founder-notes",
          title: "Founder notes",
          markdown: "# Founder notes",
          sourceKind: "markdown",
          sourceIds: ["source_001"],
          authorId: "user_123",
          idempotencyKey: " document-001 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(CoeditingError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("rejects padded append-version idempotency keys before returning version receipts", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.coediting.appendVersion, {
          workspaceId: "workspace_123",
          documentId: "document_123",
          versionId: "version_002",
          priorVersionId: "version_001",
          markdown: "# Updated notes",
          author: { type: "agent", id: "planner_agent" },
          sourceMetadata: {
            kind: "markdown",
            title: "Founder notes",
            sourceIds: ["source_001"],
          },
          idempotencyKey: " version-002 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(CoeditingError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });

  it("rejects padded annotation idempotency keys before deriving annotation ids", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      return yield* confect
        .mutation(refs.public.ops.coediting.createAnnotation, {
          workspaceId: "workspace_123",
          documentId: "document_123",
          versionId: "version_002",
          startOffset: 4,
          endOffset: 20,
          quotedText: "Updated notes",
          author: { type: "human", id: "user_123" },
          body: "Needs citation.",
          idempotencyKey: " annotation-001 ",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(CoeditingError.ValidationFailed);
    expect(result).toMatchObject({
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
    });
  });
});
