import * as Ref from "@confect/core/Ref";

import refs from "../../../_generated/refs";
import { defineCapabilityRelease } from "../../../workflows/_kit/publication";

export const publicationEchoV1Release = defineCapabilityRelease({
  logicalKey: "capability.fixture.publicationEcho",
  version: 1,
  lifecycle: "published",
  authority: {
    schemaVersion: 1,
    descriptorChecksum:
      "a1cc443684ae84a3d58e6fd202b4137741a72b7afb2cef2fc68a1f862fad4bea",
    sourceClosure: {
      roots: [
        "packages/convex/confect/capabilities/_versions/publicationEcho/v1.operation.ts",
      ],
      modules: [
        {
          path: "packages/convex/confect/capabilities/_versions/publicationEcho/v1.operation.ts",
          checksum:
            "c03597cdef9f80b81255c9ab1fa25e77df19374f8b4acdbd9ee6b541c430e37b",
        },
      ],
      checksum:
        "546d6ce653ff332856a2255b73ae9f501d5daf8fe0529d3808221eaa2baa828c",
    },
  },
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
    "546d6ce653ff332856a2255b73ae9f501d5daf8fe0529d3808221eaa2baa828c",
  releaseChecksum:
    "9c8e64560a06116a01fbb3f5c6af4b7670a1e067bc9eb01d607c346623fee893",
  semanticComplete: true,
  isolatedFixture: true,
});
