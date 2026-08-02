import { FunctionSpec, GroupSpec } from "@confect/core";
import * as S from "effect/Schema";

const NonEmptyString = S.String.pipe(S.check(S.isMinLength(1)));
const SourceKind = S.Literals(["markdown", "link", "note", "document"]);
const ClaimStatus = S.Literals(["supported", "disputed", "unsupported-draft"]);
const Freshness = S.Literals(["fresh", "review-due", "stale"]);

export const UpsertConceptArgs = S.Struct({
  workspaceId: NonEmptyString,
  conceptId: NonEmptyString,
  label: NonEmptyString,
  description: NonEmptyString,
});

export const UpsertClaimArgs = S.Struct({
  workspaceId: NonEmptyString,
  claimId: NonEmptyString,
  conceptIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  body: NonEmptyString,
  status: ClaimStatus,
  citationIds: S.Array(NonEmptyString),
});

export const AttachCitationArgs = S.Struct({
  workspaceId: NonEmptyString,
  citationId: NonEmptyString,
  claimId: NonEmptyString,
  sourceId: NonEmptyString,
  sourceKind: SourceKind,
  sourceTitle: NonEmptyString,
  quotedText: NonEmptyString,
  startOffset: S.Number,
  endOffset: S.Number,
});

export const BuildContextPackArgs = S.Struct({
  workspaceId: NonEmptyString,
  contextPackId: NonEmptyString,
  title: NonEmptyString,
  sourceIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  citationIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  claimIds: S.Array(NonEmptyString).pipe(S.check(S.isMinLength(1))),
  freshness: Freshness,
  trustReceiptId: NonEmptyString,
});

export const GetContextPackArgs = S.Struct({
  workspaceId: NonEmptyString,
  contextPackId: NonEmptyString,
});

export const ConceptReturn = S.Struct({
  conceptId: S.String,
  workspaceId: S.String,
  label: S.String,
  description: S.String,
  createdAt: S.Number,
  updatedAt: S.Number,
});

export const ClaimReturn = S.Struct({
  claimId: S.String,
  workspaceId: S.String,
  conceptIds: S.Array(S.String),
  body: S.String,
  status: ClaimStatus,
  citationIds: S.Array(S.String),
  createdAt: S.Number,
});

export const CitationReturn = S.Struct({
  citationId: S.String,
  workspaceId: S.String,
  claimId: S.String,
  sourceId: S.String,
  sourceKind: SourceKind,
  sourceTitle: S.String,
  quotedText: S.String,
  startOffset: S.Number,
  endOffset: S.Number,
  createdAt: S.Number,
});

export const ContextPackReturn = S.Struct({
  contextPackId: S.String,
  workspaceId: S.String,
  title: S.String,
  sourceIds: S.Array(S.String),
  citationIds: S.Array(S.String),
  claimIds: S.Array(S.String),
  freshness: Freshness,
  trustReceiptId: S.String,
  sourceBacked: S.Boolean,
  createdAt: S.Number,
});

export namespace KnowledgeError {
  export class CitationRequired extends S.TaggedErrorClass<CitationRequired>()(
    "CitationRequired",
    {
      claimId: S.String,
    },
  ) {}

  export class WorkspaceNotFound extends S.TaggedErrorClass<WorkspaceNotFound>()(
    "WorkspaceNotFound",
    {
      workspaceId: S.String,
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
    CitationRequired,
    WorkspaceNotFound,
    ValidationFailed,
  ]);
}

const upsertConcept = FunctionSpec.publicMutation({
  name: "upsertConcept",
  args: () => UpsertConceptArgs,
  returns: () => ConceptReturn,
  error: () => KnowledgeError.Schema,
});

const upsertClaim = FunctionSpec.publicMutation({
  name: "upsertClaim",
  args: () => UpsertClaimArgs,
  returns: () => ClaimReturn,
  error: () => KnowledgeError.Schema,
});

const attachCitation = FunctionSpec.publicMutation({
  name: "attachCitation",
  args: () => AttachCitationArgs,
  returns: () => CitationReturn,
  error: () => KnowledgeError.Schema,
});

const buildContextPack = FunctionSpec.publicMutation({
  name: "buildContextPack",
  args: () => BuildContextPackArgs,
  returns: () => ContextPackReturn,
  error: () => KnowledgeError.Schema,
});

const getContextPack = FunctionSpec.publicQuery({
  name: "getContextPack",
  args: () => GetContextPackArgs,
  returns: () => ContextPackReturn,
  error: () => KnowledgeError.Schema,
});

export default GroupSpec.make()
  .addFunction(upsertConcept)
  .addFunction(upsertClaim)
  .addFunction(attachCitation)
  .addFunction(buildContextPack)
  .addFunction(getContextPack);
