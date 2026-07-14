import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  BrainPageRow,
  PageRevisionRow,
  assertValidBrainPageGraph,
  toPublicPageSummary,
} from "../confect/brain/pageSchemas";
import brainPages from "../confect/tables/brainPages";
import pageRevisions from "../confect/tables/pageRevisions";

const basePage = {
  workspaceId: "workspaces_1",
  organizationId: "organizations_1",
  slug: "legacy-root",
  title: "Root",
  markdown: "# Root",
  sourceKind: "markdown" as const,
  updatedAt: 10,
  pageKey: "pag_root0001",
  parentPageKey: null,
  siblingSlug: "root",
  sortKey: "0000000001",
  favorite: false,
  status: "active" as const,
  currentRevisionKey: "rev_root0001",
  lifecycle: {
    state: "active" as const,
    generation: 1,
    updatedAt: 10,
    purgeAfter: null,
  },
  createdAt: 1,
  schemaVersion: 1,
};

const baseRevision = {
  workspaceId: "workspaces_1",
  organizationId: "organizations_1",
  pageKey: "pag_root0001",
  revisionKey: "rev_root0001",
  priorRevisionKey: null,
  blockNoteJson: "[]",
  markdown: "# Root",
  contentHash: "sha256:root",
  causation: "human-edit" as const,
  actor: { kind: "user" as const, id: "users_1" },
  modelReceiptKey: null,
  effectKey: "effect-root",
  state: "published" as const,
  lifecycle: {
    state: "active" as const,
    generation: 1,
    updatedAt: 10,
    purgeAfter: null,
  },
  createdAt: 10,
  schemaVersion: 1,
};

type TestPage = Omit<
  typeof basePage,
  "parentPageKey" | "currentRevisionKey"
> & { parentPageKey: string | null; currentRevisionKey: string | null };

const page = (overrides: Partial<TestPage> = {}): TestPage => ({
  ...basePage,
  ...overrides,
});

type TestRevision = Omit<
  typeof baseRevision,
  "priorRevisionKey" | "modelReceiptKey"
> & { priorRevisionKey: string | null; modelReceiptKey: string | null };

const revision = (overrides: Partial<TestRevision> = {}): TestRevision => ({
  ...baseRevision,
  ...overrides,
});

describe("Brain page stable tree schema", () => {
  it("declares canonical Brain page and revision indexes", () => {
    expect(brainPages.indexes).toMatchObject({
      by_workspace_page_key: ["workspaceId", "pageKey"],
      by_workspace_parent_sort: ["workspaceId", "parentPageKey", "sortKey"],
      by_workspace_parent_slug: ["workspaceId", "parentPageKey", "siblingSlug"],
      by_workspace_status: ["workspaceId", "status"],
    });
    expect(pageRevisions.indexes).toMatchObject({
      by_workspace_revision_key: ["workspaceId", "revisionKey"],
      by_page_created: ["workspaceId", "pageKey", "createdAt"],
      by_page_hash: ["workspaceId", "pageKey", "contentHash"],
      by_effect_key: ["workspaceId", "effectKey"],
    });
  });

  it("validates stable page and immutable revision rows", () => {
    expect(Schema.decodeUnknownSync(BrainPageRow)(page())).toMatchObject({
      pageKey: "pag_root0001",
      lifecycle: { state: "active" },
    });
    expect(Schema.decodeUnknownSync(PageRevisionRow)(revision())).toMatchObject(
      {
        revisionKey: "rev_root0001",
        state: "published",
      },
    );
  });

  it("rejects duplicate page keys inside a Brain", () => {
    expect(() =>
      assertValidBrainPageGraph({
        pages: [page(), page({ title: "Duplicate title" })],
        revisions: [revision()],
      }),
    ).toThrow("PageTreeConflict");
  });

  it("rejects duplicate active sibling slugs", () => {
    expect(() =>
      assertValidBrainPageGraph({
        pages: [
          page(),
          page({ pageKey: "pag_child001", currentRevisionKey: "rev_child001" }),
        ],
        revisions: [
          revision(),
          revision({ revisionKey: "rev_child001", pageKey: "pag_child001" }),
        ],
      }),
    ).toThrow("PageTreeConflict");
  });

  it("rejects parents in another Brain", () => {
    expect(() =>
      assertValidBrainPageGraph({
        pages: [
          page(),
          page({
            workspaceId: "workspaces_2",
            pageKey: "pag_child001",
            parentPageKey: "pag_root0001",
            siblingSlug: "child",
            currentRevisionKey: "rev_child001",
          }),
        ],
        revisions: [
          revision(),
          revision({
            workspaceId: "workspaces_2",
            revisionKey: "rev_child001",
            pageKey: "pag_child001",
          }),
        ],
      }),
    ).toThrow("ParentPageNotFound");
  });

  it("rejects page tree cycles", () => {
    expect(() =>
      assertValidBrainPageGraph({
        pages: [
          page({ parentPageKey: "pag_child001" }),
          page({
            pageKey: "pag_child001",
            parentPageKey: "pag_root0001",
            siblingSlug: "child",
            currentRevisionKey: "rev_child001",
          }),
        ],
        revisions: [
          revision(),
          revision({ revisionKey: "rev_child001", pageKey: "pag_child001" }),
        ],
      }),
    ).toThrow("PageCycle");
  });

  it("rejects invalid sort keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(BrainPageRow)(page({ sortKey: "1" })),
    ).toThrow();
  });

  it("rejects current revisions from another page", () => {
    expect(() =>
      assertValidBrainPageGraph({
        pages: [page()],
        revisions: [revision({ pageKey: "pag_other001" })],
      }),
    ).toThrow("TenantMismatch");
  });

  it("does not expose public Convex IDs in page summaries", () => {
    const summary = toPublicPageSummary(page());

    expect(summary).toEqual({
      pageKey: "pag_root0001",
      parentPageKey: null,
      siblingSlug: "root",
      sortKey: "0000000001",
      title: "Root",
      favorite: false,
      status: "active",
      currentRevisionKey: "rev_root0001",
      lifecycleGeneration: 1,
    });
    expect(JSON.stringify(summary)).not.toContain("workspaces_");
    expect(JSON.stringify(summary)).not.toContain("organizations_");
  });
});
