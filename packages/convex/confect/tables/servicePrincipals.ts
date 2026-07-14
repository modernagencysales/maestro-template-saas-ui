import { Table } from "@confect/server";

import { ServicePrincipalRow } from "../headless/auth";

export default Table.make(() => ServicePrincipalRow)
  .index("by_workspace", ["workspaceId"])
  .index("by_brain_status", ["workspaceId", "brainKey", "status"])
  .index("by_created_by", ["createdByUserId"]);
