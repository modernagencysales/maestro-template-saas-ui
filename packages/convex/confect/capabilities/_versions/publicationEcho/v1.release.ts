import * as Ref from "@confect/core/Ref";

import refs from "../../../_generated/refs";
import { defineCapabilityRelease } from "../../../workflows/_kit/publication";
import { publicationEchoV1Authority } from "./v1.authority";

export const publicationEchoV1Release = defineCapabilityRelease({
  logicalKey: "capability.fixture.publicationEcho",
  version: 1,
  lifecycle: "published",
  authority: publicationEchoV1Authority,
  functionRef: Ref.getFunctionReference(
    refs.internal.capabilities._versions.publicationEcho.v1.run,
  ),
  functionReference: "capabilities/_versions/publicationEcho/v1:run",
  argsSchema: "capabilities.publicationEcho.v1.args",
  returnSchema: "capabilities.publicationEcho.v1.result",
  effectManifest: { kind: "mutation", external: false },
  dependencyManifest: [
    {
      module:
        "packages/convex/confect/capabilities/_versions/publicationEcho/v1.operation.ts",
      checksum:
        "c03597cdef9f80b81255c9ab1fa25e77df19374f8b4acdbd9ee6b541c430e37b",
    },
  ],
  sourceClosureChecksum:
    "fd925795e29f209c349be954925ba3ecb130d2121061a912807d21cc4f10fdac",
  releaseChecksum:
    "267c2d5eda0b09707f0227d0fe679a9c1da82dfa40ddbe7d912779230960e533",
  semanticComplete: true,
  isolatedFixture: true,
});
