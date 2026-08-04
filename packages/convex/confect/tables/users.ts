import { Table } from "@confect/server";

import { UserRow } from "../access/tenancySchemas";

export default Table.make(() => UserRow)
  .index("by_subject", ["subject"])
  // ponytail: remove the cast when Confect exposes Convex staged index config.
  .index("by_token_identifier", {
    fields: ["tokenIdentifier"],
    staged: true,
  } as never)
  .index("by_email", ["email"]);
