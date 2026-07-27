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
    "aa03094f4f6877490b3169e0d08cba27406928f70493c1d7606d86da54fd7939",
  releaseChecksum:
    "becd9e4ab3053d4bee260ca31874d120e08bd988d3318a7c48a0c7d81763876f",
  stableStepNames: ["start.v2", "receipt.v2"],
  semanticComplete: true,
  isolatedFixture: true,
});
