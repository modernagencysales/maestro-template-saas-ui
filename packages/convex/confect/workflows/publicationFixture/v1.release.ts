import { makeFunctionReference, type FunctionReference } from "convex/server";

import { publicationEchoV1Release } from "../../capabilities/_versions/publicationEcho/v1.release";
import { defineWorkflowRelease } from "../_kit/publication";
import { publicationFixtureGraph } from "./v1.graph";
import { publicationFixtureApprovalDecisionEvent } from "./v1.registry";
import { publicationFixtureV1Authority } from "./v1.authority";

export const publicationFixtureV1Release = defineWorkflowRelease({
  workflowId: publicationFixtureGraph.id,
  version: 1,
  lifecycle: "published",
  authority: publicationFixtureV1Authority,
  graphModule:
    "packages/convex/confect/workflows/publicationFixture/v1.graph.ts",
  graphHash: "2c4c348ac937797e21618686ab80768538f4d7484064dc33e2c0e73549312d36",
  runner: {
    ref: makeFunctionReference<"mutation">(
      "workflowRunners/publicationFixture/v1:run",
    ) as unknown as FunctionReference<"mutation", "internal">,
    module: "workflowRunners/publicationFixture/v1:run",
    functionReference: "workflowRunners/publicationFixture/v1:run",
  },
  events: [
    {
      definition: publicationFixtureApprovalDecisionEvent.reference,
      validator: publicationFixtureApprovalDecisionEvent.schemaName,
    },
  ],
  completion: {
    ref: makeFunctionReference<"mutation">(
      "workflowRunners/publicationFixture/v1:onComplete",
    ) as unknown as FunctionReference<"mutation", "internal">,
    module: "workflowRunners/publicationFixture/v1:onComplete",
    version: 1,
  },
  kickoffProfiles: ["eager-first-poll", "queued"],
  capabilityBindings: [
    {
      logicalKey: publicationEchoV1Release.logicalKey,
      version: publicationEchoV1Release.version,
      releaseChecksum: publicationEchoV1Release.releaseChecksum,
    },
  ],
  subworkflowBindings: [],
  runtimeVersion: "maestro-workflow-runtime.v2",
  interpreter: {
    module: "packages/convex/confect/workflows/_kit/graphRunnerV2.ts",
    checksum:
      "980cd9f429d0b47193ec8783252e1fb0b6589e1bd0d61fab2cdb986b1f9ffaa4",
  },
  lifecycleContractVersion: 1,
  sourceClosureChecksum:
    "e7680b6ed35ebb9ee917386c41872329e703993e3b08c98441450136a63e26f2",
  releaseChecksum:
    "7b271c932a7ef9f7d93a7505ed2a714b44f948de97ce70e40c19831fc46d847a",
  stableStepNames: ["start.v2", "receipt.v2"],
  semanticComplete: true,
  isolatedFixture: true,
});
