import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";
import {
  LifecycleEnvelope,
  PageKey,
  PageStatus,
  RevisionKey,
  SiblingSlug,
  SortKey,
} from "../brain/pageSchemas";

export default Table.make(() =>
  Schema.Struct({
    workspaceId: Id("workspaces"),
    organizationId: Schema.optional(Schema.String),
    slug: Schema.String,
    title: Schema.String,
    markdown: Schema.String,
    editorSnapshotJson: Schema.optional(Schema.String),
    editorSnapshotVersion: Schema.optional(Schema.Number),
    sourceKind: Schema.Literal("markdown", "link", "note"),
    updatedAt: Schema.Number,
    pageKey: Schema.optional(PageKey),
    parentPageKey: Schema.optional(Schema.NullOr(PageKey)),
    siblingSlug: Schema.optional(SiblingSlug),
    sortKey: Schema.optional(SortKey),
    favorite: Schema.optional(Schema.Boolean),
    status: Schema.optional(PageStatus),
    currentRevisionKey: Schema.optional(Schema.NullOr(RevisionKey)),
    lifecycle: Schema.optional(LifecycleEnvelope),
    createdAt: Schema.optional(Schema.Number),
    schemaVersion: Schema.optional(Schema.Number),
  }),
)
  .index("by_workspace", ["workspaceId"])
  .index("by_workspace_slug", ["workspaceId", "slug"])
  .index("by_workspace_page_key", ["workspaceId", "pageKey"])
  .index("by_workspace_parent_sort", [
    "workspaceId",
    "parentPageKey",
    "sortKey",
  ])
  .index("by_workspace_parent_slug", [
    "workspaceId",
    "parentPageKey",
    "siblingSlug",
  ])
  .index("by_workspace_status", ["workspaceId", "status"]);
