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
    "aa775e72f16e401d061d0c68fca6cc757f07015ecfca2f91ae017d1150bfccbb",
  releaseChecksum:
    "590a704237280e9f0a81dcde4923d6d6c3848580afa4b5e2b445ed19005760d3",
  semanticComplete: true,
  isolatedFixture: true,
});
