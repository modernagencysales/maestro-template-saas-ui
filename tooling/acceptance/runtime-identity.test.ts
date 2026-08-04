import { describe, expect, it } from "vitest";

import {
  assertRuntimeIdentityEquality,
  type BackendRuntimeIdentity,
} from "../../features/support/runtime-identity";

const backend = (deploymentId: string): BackendRuntimeIdentity => ({
  deploymentId,
  inputDigest: `sha256:${"a".repeat(64)}`,
  startNonce: `start-${deploymentId}`,
});

describe("independent runtime identity observations", () => {
  it("accepts exact controller, web, and CLI backend equality", () => {
    const identity = backend("deployment-one");
    expect(
      assertRuntimeIdentityEquality({
        expected: identity,
        controller: structuredClone(identity),
        web: structuredClone(identity),
        cli: structuredClone(identity),
      }),
    ).toEqual(identity);
  });

  it.each(["web", "cli"] as const)(
    "rejects %s pointed at a second backend",
    (surface) => {
      const identity = backend("deployment-one");
      expect(() =>
        assertRuntimeIdentityEquality({
          expected: identity,
          controller: identity,
          web: surface === "web" ? backend("deployment-two") : identity,
          cli: surface === "cli" ? backend("deployment-two") : identity,
        }),
      ).toThrow(/backend identity.*differs/u);
    },
  );
});
