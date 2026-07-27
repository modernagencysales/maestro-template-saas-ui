import { makeFunctionReference, type FunctionReference } from "convex/server";

import { defineCapabilityRelease } from "../../../workflows/_kit/publication";
import { publicationEchoV1Authority } from "./v1.authority";

export const publicationEchoV1Release = defineCapabilityRelease({
  logicalKey: "capability.fixture.publicationEcho",
  version: 1,
  lifecycle: "published",
  authority: publicationEchoV1Authority,
  functionRef: makeFunctionReference<"mutation">(
    "capabilities/_versions/publicationEcho/v1:run",
  ) as unknown as FunctionReference<"mutation", "internal">,
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
    "736c4447ad992b35b6a52c87de6332afbe815b5967137243babe923c83a6402c",
  releaseChecksum:
    "e16f3fc4cb2b8bdfde7ce85c585b76b625394b5d24d3cb5fb242a92f52307e97",
  semanticComplete: true,
  isolatedFixture: true,
});
