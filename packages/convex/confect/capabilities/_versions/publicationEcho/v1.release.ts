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
    "3c967c70fff38533ffbbdee16e0c93a4502047494dba1baa331fe61e1bb9d513",
  releaseChecksum:
    "700eab0360875a9e5e551a7bce49e7f9324b809358f44aab78395fc3b9f81f10",
  semanticComplete: true,
  isolatedFixture: true,
});
