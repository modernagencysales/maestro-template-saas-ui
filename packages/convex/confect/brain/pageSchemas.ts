import * as Schema from "effect/Schema";

export const PageLifecycleState = Schema.Literal(
  "active",
  "archived",
  "redacted",
  "purged",
);

export const RevisionLifecycleState = Schema.Literal(
  "active",
  "redacted",
  "purged",
);

export const PageStatus = Schema.Literal(
  "active",
  "archived",
  "redacted",
  "purged",
);

export const RevisionState = Schema.Literal(
  "draft",
  "proposed",
  "published",
  "rejected",
  "redacted",
  "purged",
);

export const PageKey = Schema.String.pipe(
  Schema.pattern(/^pag_[a-z0-9][a-z0-9_-]{2,}$/),
);
export const RevisionKey = Schema.String.pipe(
  Schema.pattern(/^rev_[a-z0-9][a-z0-9_-]{2,}$/),
);
export const SiblingSlug = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
);
export const SortKey = Schema.String.pipe(
  Schema.pattern(/^\d{10}(?:\.[a-z0-9]{1,16})?$/),
);

export const LifecycleEnvelope = Schema.Struct({
  state: PageLifecycleState,
  generation: Schema.Number,
  updatedAt: Schema.Number,
  purgeAfter: Schema.NullOr(Schema.Number),
});

export const RevisionLifecycleEnvelope = Schema.Struct({
  state: RevisionLifecycleState,
  generation: Schema.Number,
  updatedAt: Schema.Number,
  purgeAfter: Schema.NullOr(Schema.Number),
});

export const RevisionActor = Schema.Struct({
  kind: Schema.Literal("user", "agent", "system", "migration"),
  id: Schema.String,
});

export const BrainPageRow = Schema.Struct({
  workspaceId: Schema.String,
  organizationId: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  markdown: Schema.String,
  editorSnapshotJson: Schema.optional(Schema.String),
  editorSnapshotVersion: Schema.optional(Schema.Number),
  sourceKind: Schema.Literal("markdown", "link", "note"),
  updatedAt: Schema.Number,
  pageKey: PageKey,
  parentPageKey: Schema.NullOr(PageKey),
  siblingSlug: SiblingSlug,
  sortKey: SortKey,
  favorite: Schema.Boolean,
  status: PageStatus,
  currentRevisionKey: Schema.NullOr(RevisionKey),
  lifecycle: LifecycleEnvelope,
  createdAt: Schema.Number,
  schemaVersion: Schema.Number,
});

export const PageRevisionRow = Schema.Struct({
  workspaceId: Schema.String,
  organizationId: Schema.String,
  pageKey: PageKey,
  revisionKey: RevisionKey,
  priorRevisionKey: Schema.NullOr(RevisionKey),
  blockNoteJson: Schema.String,
  markdown: Schema.String,
  contentHash: Schema.String,
  causation: Schema.Literal(
    "human-edit",
    "agent-edit",
    "import",
    "migration",
    "restore",
  ),
  actor: RevisionActor,
  modelReceiptKey: Schema.NullOr(Schema.String),
  effectKey: Schema.String,
  state: RevisionState,
  lifecycle: RevisionLifecycleEnvelope,
  createdAt: Schema.Number,
  schemaVersion: Schema.Number,
});

export type BrainPage = Schema.Schema.Type<typeof BrainPageRow>;
export type PageRevision = Schema.Schema.Type<typeof PageRevisionRow>;

export class PageNotFound extends Error {
  readonly _tag = "PageNotFound";
  constructor(message = "PageNotFound") {
    super(message);
  }
}

export class ParentPageNotFound extends Error {
  readonly _tag = "ParentPageNotFound";
  constructor(message = "ParentPageNotFound") {
    super(message);
  }
}

export class PageTreeConflict extends Error {
  readonly _tag = "PageTreeConflict";
  constructor(message = "PageTreeConflict") {
    super(message);
  }
}

export class PageCycle extends Error {
  readonly _tag = "PageCycle";
  constructor(message = "PageCycle") {
    super(message);
  }
}

export class RevisionNotFound extends Error {
  readonly _tag = "RevisionNotFound";
  constructor(message = "RevisionNotFound") {
    super(message);
  }
}

export class TenantMismatch extends Error {
  readonly _tag = "TenantMismatch";
  constructor(message = "TenantMismatch") {
    super(message);
  }
}

export type BrainPageTreeError =
  | PageNotFound
  | ParentPageNotFound
  | PageTreeConflict
  | PageCycle
  | RevisionNotFound
  | TenantMismatch;

export interface BrainPageGraphInput {
  readonly pages: readonly BrainPage[];
  readonly revisions: readonly PageRevision[];
}

export interface PublicPageSummary {
  readonly pageKey: string;
  readonly parentPageKey: string | null;
  readonly siblingSlug: string;
  readonly sortKey: string;
  readonly title: string;
  readonly favorite: boolean;
  readonly status: BrainPage["status"];
  readonly currentRevisionKey: string | null;
  readonly lifecycleGeneration: number;
}

export const toPublicPageSummary = (page: BrainPage): PublicPageSummary => ({
  pageKey: page.pageKey,
  parentPageKey: page.parentPageKey,
  siblingSlug: page.siblingSlug,
  sortKey: page.sortKey,
  title: page.title,
  favorite: page.favorite,
  status: page.status,
  currentRevisionKey: page.currentRevisionKey,
  lifecycleGeneration: page.lifecycle.generation,
});

export const assertValidBrainPageGraph = ({
  pages,
  revisions,
}: BrainPageGraphInput): void => {
  const pageByTenantKey = new Map<string, BrainPage>();
  const pageByKey = new Map<string, BrainPage[]>();
  const activeSiblingSlugs = new Set<string>();

  for (const page of pages) {
    const tenantKey = `${page.workspaceId}:${page.pageKey}`;
    if (pageByTenantKey.has(tenantKey)) {
      throw new PageTreeConflict(
        "PageTreeConflict: duplicate page key in Brain",
      );
    }
    pageByTenantKey.set(tenantKey, page);
    pageByKey.set(page.pageKey, [...(pageByKey.get(page.pageKey) ?? []), page]);

    if (page.status === "active") {
      const siblingKey = `${page.workspaceId}:${page.parentPageKey ?? "root"}:${page.siblingSlug}`;
      if (activeSiblingSlugs.has(siblingKey)) {
        throw new PageTreeConflict(
          "PageTreeConflict: duplicate active sibling slug",
        );
      }
      activeSiblingSlugs.add(siblingKey);
    }
  }

  const revisionByTenantKey = new Map<string, PageRevision>();
  for (const revision of revisions) {
    const tenantKey = `${revision.workspaceId}:${revision.revisionKey}`;
    if (revisionByTenantKey.has(tenantKey)) {
      throw new PageTreeConflict(
        "PageTreeConflict: duplicate revision key in Brain",
      );
    }
    revisionByTenantKey.set(tenantKey, revision);
  }

  for (const page of pages) {
    if (page.parentPageKey !== null) {
      const parent = pageByTenantKey.get(
        `${page.workspaceId}:${page.parentPageKey}`,
      );
      if (parent === undefined) {
        const sameKeyElsewhere = pageByKey.get(page.parentPageKey) ?? [];
        if (sameKeyElsewhere.length > 0) {
          throw new ParentPageNotFound(
            "ParentPageNotFound: parent belongs to another Brain",
          );
        }
        throw new ParentPageNotFound("ParentPageNotFound");
      }
      if (parent.organizationId !== page.organizationId) {
        throw new TenantMismatch(
          "TenantMismatch: parent organization mismatch",
        );
      }
    }

    if (page.currentRevisionKey !== null) {
      const currentRevision = revisionByTenantKey.get(
        `${page.workspaceId}:${page.currentRevisionKey}`,
      );
      if (currentRevision === undefined) {
        throw new RevisionNotFound("RevisionNotFound");
      }
      if (
        currentRevision.pageKey !== page.pageKey ||
        currentRevision.organizationId !== page.organizationId
      ) {
        throw new TenantMismatch(
          "TenantMismatch: current revision belongs to another page",
        );
      }
    }
  }

  for (const page of pages) {
    const seen = new Set<string>();
    let cursor: BrainPage | undefined = page;
    while (cursor !== undefined && cursor.parentPageKey !== null) {
      const cursorKey = `${cursor.workspaceId}:${cursor.pageKey}`;
      if (seen.has(cursorKey)) {
        throw new PageCycle("PageCycle");
      }
      seen.add(cursorKey);
      cursor = pageByTenantKey.get(
        `${cursor.workspaceId}:${cursor.parentPageKey}`,
      );
    }
  }
};
