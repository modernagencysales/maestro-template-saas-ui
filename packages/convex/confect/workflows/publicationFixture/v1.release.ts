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
      "f221ac01b5ed864c05dfce752b8ef2fca4b5ef173a8e338fc64b798f3863a288",
  },
  lifecycleContractVersion: 1,
  sourceClosureChecksum:
    "d0ef318d4b3bb3db85da4176e693c5c9eb0b283991c0e138657f7c2a6a97e0b0",
  releaseChecksum:
    "3f0fa1216e46d0f4e1b0b365f4dfb455dad98a4c04f24b96c3cb2e58668753ee",
  stableStepNames: ["start.v2", "receipt.v2"],
  semanticComplete: true,
  isolatedFixture: true,
});
