import * as Ref from "@confect/core/Ref";

import refs from "../../_generated/refs";
import { publicationEchoV1Release } from "../../capabilities/_versions/publicationEcho/v1.release";
import { defineWorkflowRelease } from "../_kit/publication";
import { publicationFixtureGraph } from "./v1.graph";
import { publicationFixtureApprovalDecisionEvent } from "./v1.registry";

export const publicationFixtureV1Release = defineWorkflowRelease({
  workflowId: publicationFixtureGraph.id,
  version: 1,
  lifecycle: "published",
  authority: {
    schemaVersion: 1,
    descriptorChecksum:
      "efbf7012c0d7dafb2bc80d50c40b6c2a1b0d0b98bf1fc51b58fbb7dc1f50d611",
    sourceClosure: {
      roots: [
        "packages/convex/confect/workflows/_kit/graphRunnerV2.ts",
        "packages/convex/confect/workflows/publicationFixture/v1.graph.ts",
      ],
      modules: [
        {
          path: "packages/convex/confect/workflows/_kit/graphRunnerV2.ts",
          checksum:
            "f221ac01b5ed864c05dfce752b8ef2fca4b5ef173a8e338fc64b798f3863a288",
        },
        {
          path: "packages/convex/confect/workflows/publicationFixture/v1.graph.ts",
          checksum:
            "93115ef21f488fd4b8ace001edcb6e30683b7e8a995997045820ccce6ed150e2",
        },
      ],
      checksum:
        "d278e3e7a2194f7d738e679164e8b51ef485e7b656504c270df7b849c4602f99",
    },
  },
  graphModule:
    "packages/convex/confect/workflows/publicationFixture/v1.graph.ts",
  graphHash: "93115ef21f488fd4b8ace001edcb6e30683b7e8a995997045820ccce6ed150e2",
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
    "d278e3e7a2194f7d738e679164e8b51ef485e7b656504c270df7b849c4602f99",
  releaseChecksum:
    "e38eb6503b44ca125f015799369130665b90cc49d099cfe19247f943ac126d23",
  stableStepNames: ["start.v2", "receipt.v2"],
  semanticComplete: true,
  isolatedFixture: true,
});
