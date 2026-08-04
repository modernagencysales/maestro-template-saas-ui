import { describe, expect, it } from "vitest";

import {
  createRuntimeIdentity,
  readRuntimeIdentity,
} from "../confect/runtime/identity";

describe("runtime identity", () => {
  it("keeps the server-created start identity stable and rejects caller fields", () => {
    const identity = createRuntimeIdentity({
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}`,
      randomUUID: () => "server-start-one",
    });

    expect(readRuntimeIdentity(identity, {})).toEqual({
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}`,
      startNonce: "server-start-one",
    });
    expect(() =>
      readRuntimeIdentity(identity, { deploymentId: "forged" }),
    ).toThrow(/does not accept caller identity/u);
  });
});
