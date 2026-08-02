import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import knowledge, {
  AttachCitationArgs,
  BuildContextPackArgs,
  ClaimReturn,
  ContextPackReturn,
  KnowledgeError,
  UpsertClaimArgs,
  UpsertConceptArgs,
} from "../confect/ops/knowledge.spec";
import knowledgeImpl from "../confect/ops/knowledge.impl";
import citations from "../confect/tables/citations";
import claims from "../confect/tables/claims";
import concepts from "../confect/tables/concepts";
import contextPacks from "../confect/tables/contextPacks";

describe("knowledge Confect contracts", () => {
  it("declares workspace-owned knowledge tables with stable indexes", () => {
    expect(concepts.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_label: ["workspaceId", "label"],
    });
    expect(claims.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_status: ["workspaceId", "status"],
    });
    expect(citations.indexes).toMatchObject({
      by_claim: ["claimId"],
      by_source: ["sourceId"],
      by_workspace: ["workspaceId"],
    });
    expect(contextPacks.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_trust_receipt: ["trustReceiptId"],
    });
  });

  it("validates concept, claim, citation, and context-pack args", () => {
    expect(
      Schema.decodeUnknownSync(UpsertConceptArgs)({
        workspaceId: "workspace_123",
        conceptId: "concept_gtm",
        label: "GTM Brain",
        description: "Source-backed GTM operating context.",
      }),
    ).toMatchObject({ conceptId: "concept_gtm" });

    expect(
      Schema.decodeUnknownSync(UpsertClaimArgs)({
        workspaceId: "workspace_123",
        claimId: "claim_001",
        conceptIds: ["concept_gtm"],
        body: "Acme sells implementation services.",
        status: "supported",
        citationIds: ["citation_001"],
      }),
    ).toMatchObject({ status: "supported" });

    expect(
      Schema.decodeUnknownSync(AttachCitationArgs)({
        workspaceId: "workspace_123",
        citationId: "citation_001",
        claimId: "claim_001",
        sourceId: "source_founder_notes",
        sourceKind: "markdown",
        sourceTitle: "Founder notes",
        quotedText: "implementation services",
        startOffset: 12,
        endOffset: 35,
      }),
    ).toMatchObject({ sourceKind: "markdown" });

    expect(
      Schema.decodeUnknownSync(BuildContextPackArgs)({
        workspaceId: "workspace_123",
        contextPackId: "context_pack_gtm",
        title: "GTM foundation",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        claimIds: ["claim_001"],
        freshness: "fresh",
        trustReceiptId: "trust_receipt_001",
      }),
    ).toMatchObject({ freshness: "fresh" });
  });

  it("declares return schemas for claims and context packs", () => {
    expect(
      Schema.decodeUnknownSync(ClaimReturn)({
        claimId: "claim_001",
        workspaceId: "workspace_123",
        conceptIds: ["concept_gtm"],
        body: "Acme sells implementation services.",
        status: "supported",
        citationIds: ["citation_001"],
        createdAt: 1,
      }),
    ).toMatchObject({ citationIds: ["citation_001"] });

    expect(
      Schema.decodeUnknownSync(ContextPackReturn)({
        contextPackId: "context_pack_gtm",
        workspaceId: "workspace_123",
        title: "GTM foundation",
        sourceIds: ["source_founder_notes"],
        citationIds: ["citation_001"],
        claimIds: ["claim_001"],
        freshness: "fresh",
        trustReceiptId: "trust_receipt_001",
        sourceBacked: true,
        createdAt: 1,
      }),
    ).toMatchObject({ sourceBacked: true });
  });

  it("declares public-safe typed errors for source-backed Brain work", () => {
    const encoded = [
      new KnowledgeError.CitationRequired({ claimId: "claim_001" }),
      new KnowledgeError.WorkspaceNotFound({ workspaceId: "workspace_123" }),
      new KnowledgeError.ValidationFailed({
        field: "body",
        message: "body is required.",
      }),
    ].map((error) => Schema.encodeSync(KnowledgeError.Schema)(error));

    expect(encoded.map((error) => error._tag)).toEqual([
      "CitationRequired",
      "WorkspaceNotFound",
      "ValidationFailed",
    ]);
    expect(JSON.stringify(encoded)).not.toContain("secret");
  });

  it("registers public Confect functions for knowledge operations", () => {
    const serialized = JSON.stringify(knowledge);

    expect(serialized).toContain("upsertConcept");
    expect(serialized).toContain("upsertClaim");
    expect(serialized).toContain("attachCitation");
    expect(serialized).toContain("buildContextPack");
    expect(serialized).toContain("getContextPack");
    expect(serialized).toContain("public");
  });

  it("exports a finalized fake/local Confect implementation", () => {
    expect(Layer.isLayer(knowledgeImpl)).toBe(true);
  });
});
