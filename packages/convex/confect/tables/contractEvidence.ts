import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    scenarioNonce: Schema.String,
    correlationNonce: Schema.String,
    principalDigest: Schema.String,
    surfaceId: Schema.String,
    transport: Schema.Literals(["ui", "api", "cli", "mcp", "webhook"]),
    backendDeploymentId: Schema.String,
    backendInputDigest: Schema.String,
    backendStartNonce: Schema.String,
  }),
)
  .index("by_scenario", ["scenarioNonce"])
  .index("by_scenario_correlation", ["scenarioNonce", "correlationNonce"]);
