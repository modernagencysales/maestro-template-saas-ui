import * as Ref from "@confect/core/Ref";

import refs from "../../_generated/refs";
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
    ref: Ref.getFunctionReference(
      refs.internal.workflowRunners.publicationFixture.v1.run,
    ),
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
    ref: Ref.getFunctionReference(
      refs.internal.workflowRunners.publicationFixture.v1.onComplete,
    ),
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
    "dfc30b9681bda6b25d949e4e4d460da04d3f29cdb4c5d3c17a0fca88baa96ba2",
  releaseChecksum:
    "9b3868a2bd9aadbee97fb4e5a779175cc06d06c99bab1c27a1f908bf2427a3b2",
  stableStepNames: ["start.v2", "receipt.v2"],
  semanticComplete: true,
  isolatedFixture: true,
});
