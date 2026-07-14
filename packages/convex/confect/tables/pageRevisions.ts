import { Table } from "@confect/server";

import { PageRevisionRow } from "../brain/pageSchemas";

export default Table.make(() => PageRevisionRow)
  .index("by_workspace_revision_key", ["workspaceId", "revisionKey"])
  .index("by_page_created", ["workspaceId", "pageKey", "createdAt"])
  .index("by_page_hash", ["workspaceId", "pageKey", "contentHash"])
  .index("by_effect_key", ["workspaceId", "effectKey"]);
