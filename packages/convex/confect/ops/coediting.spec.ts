import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

export const CoeditingActor = S.Struct({
  type: S.Literals(["human", "agent"]),
  id: S.String.pipe(S.check(S.isMinLength(1))),
});

export const CoeditingSourceMetadata = S.Struct({
  kind: S.Literals(["markdown", "link", "note", "document"]),
  title: S.String.pipe(S.check(S.isMinLength(1))),
  sourceIds: S.Array(S.String),
});

export const ListDocumentsArgs = S.Struct({
  workspaceId: S.String.pipe(S.check(S.isMinLength(1))),
});

export const CreateDocumentArgs = S.Struct({
  workspaceId: S.String.pipe(S.check(S.isMinLength(1))),
  slug: S.String.pipe(S.check(S.isMinLength(1))),
  title: S.String.pipe(S.check(S.isMinLength(1))),
  markdown: S.String.pipe(S.check(S.isMinLength(1))),
  sourceKind: S.Literals(["markdown", "link", "note", "document"]),
  sourceIds: S.Array(S.String),
  authorId: S.String.pipe(S.check(S.isMinLength(1))),
  idempotencyKey: S.String.pipe(S.check(S.isMinLength(1))),
});

export const AppendVersionArgs = S.Struct({
  workspaceId: S.String.pipe(S.check(S.isMinLength(1))),
  documentId: S.String.pipe(S.check(S.isMinLength(1))),
  versionId: S.String.pipe(S.check(S.isMinLength(1))),
  priorVersionId: S.optional(S.String),
  markdown: S.String.pipe(S.check(S.isMinLength(1))),
  author: CoeditingActor,
  sourceMetadata: CoeditingSourceMetadata,
  idempotencyKey: S.String.pipe(S.check(S.isMinLength(1))),
});

export const CreateAnnotationArgs = S.Struct({
  workspaceId: S.String.pipe(S.check(S.isMinLength(1))),
  documentId: S.String.pipe(S.check(S.isMinLength(1))),
  versionId: S.String.pipe(S.check(S.isMinLength(1))),
  startOffset: S.Number,
  endOffset: S.Number,
  quotedText: S.String.pipe(S.check(S.isMinLength(1))),
  author: CoeditingActor,
  body: S.String.pipe(S.check(S.isMinLength(1))),
  idempotencyKey: S.String.pipe(S.check(S.isMinLength(1))),
});

export const DocumentReturn = S.Struct({
  documentId: S.String,
  workspaceId: S.String,
  slug: S.String,
  title: S.String,
  latestVersionId: S.String,
  sourceKind: S.Literals(["markdown", "link", "note", "document"]),
  sourceIds: S.Array(S.String),
  createdAt: S.Number,
  updatedAt: S.Number,
});

export const DocumentVersionReturn = S.Struct({
  documentId: S.String,
  workspaceId: S.String,
  versionId: S.String,
  priorVersionId: S.optional(S.String),
  markdown: S.String,
  author: CoeditingActor,
  createdAt: S.Number,
});

export const DocumentAnnotationReturn = S.Struct({
  annotationId: S.String,
  documentId: S.String,
  workspaceId: S.String,
  versionId: S.String,
  startOffset: S.Number,
  endOffset: S.Number,
  quotedText: S.String,
  author: CoeditingActor,
  body: S.String,
  status: S.Literals(["open", "resolved"]),
  createdAt: S.Number,
});

export namespace CoeditingError {
  export class WorkspaceNotFound extends S.TaggedErrorClass<WorkspaceNotFound>()(
    "WorkspaceNotFound",
    {
      workspaceId: S.String,
    },
  ) {}

  export class DocumentNotFound extends S.TaggedErrorClass<DocumentNotFound>()(
    "DocumentNotFound",
    {
      documentId: S.String,
    },
  ) {}

  export class VersionConflict extends S.TaggedErrorClass<VersionConflict>()(
    "VersionConflict",
    {
      documentId: S.String,
      priorVersionId: S.String,
    },
  ) {}

  export class ValidationFailed extends S.TaggedErrorClass<ValidationFailed>()(
    "ValidationFailed",
    {
      field: S.String,
      message: S.String,
    },
  ) {}

  export const Schema = S.Union([
    WorkspaceNotFound,
    DocumentNotFound,
    VersionConflict,
    ValidationFailed,
  ]);
}

const listDocuments = FunctionSpec.publicQuery({
  name: "listDocuments",
  args: () => ListDocumentsArgs,
  returns: () => S.Array(DocumentReturn),
  error: () => CoeditingError.Schema,
});

const createDocument = FunctionSpec.publicMutation({
  name: "createDocument",
  args: () => CreateDocumentArgs,
  returns: () => DocumentReturn,
  error: () => CoeditingError.Schema,
});

const appendVersion = FunctionSpec.publicMutation({
  name: "appendVersion",
  args: () => AppendVersionArgs,
  returns: () => DocumentVersionReturn,
  error: () => CoeditingError.Schema,
});

const createAnnotation = FunctionSpec.publicMutation({
  name: "createAnnotation",
  args: () => CreateAnnotationArgs,
  returns: () => DocumentAnnotationReturn,
  error: () => CoeditingError.Schema,
});

export default GroupSpec.make()
  .addFunction(listDocuments)
  .addFunction(createDocument)
  .addFunction(appendVersion)
  .addFunction(createAnnotation);
