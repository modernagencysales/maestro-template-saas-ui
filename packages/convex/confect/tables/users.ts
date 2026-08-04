import { Table } from "@confect/server";

import { UserRow } from "../access/tenancySchemas";

export default Table.make(() => UserRow)
  .index("by_token_identifier", ["tokenIdentifier"])
  .index("by_email", ["email"]);
