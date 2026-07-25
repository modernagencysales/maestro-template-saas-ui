import { GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import {
  collectContractManifest,
  collectContractSchemas,
  defineContractFunction,
  internalMutationStep,
} from "../../_kit/capability";

export const PublicationEchoV1Args = Schema.Struct({
  workspaceId: Schema.NonEmptyString,
  value: Schema.String,
});

export const PublicationEchoV1Result = Schema.Struct({
  value: Schema.String,
  capabilityVersion: Schema.Literal(1),
});

const run = defineContractFunction(
  internalMutationStep({
    name: "run",
    args: () => PublicationEchoV1Args,
    returns: () => PublicationEchoV1Result,
  }),
  {
    namespace: "capabilities._versions.publicationEcho.v1",
    name: "run",
    operationId: "capabilities._versions.publicationEcho.v1.run",
    kind: "mutation",
    surfaces: ["workflow", "internal"],
    typedErrors: [],
    idempotent: true,
    argsSchemaName: "capabilities.publicationEcho.v1.args",
    returnsSchemaName: "capabilities.publicationEcho.v1.result",
    argsSchema: PublicationEchoV1Args,
    returnsSchema: PublicationEchoV1Result,
  },
);

const contractFunctions = [run] as const;

export const manifest = collectContractManifest(contractFunctions);
export const schemaRegistry = collectContractSchemas(contractFunctions);

export default GroupSpec.make().addFunction(run.spec);
