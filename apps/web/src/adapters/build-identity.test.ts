import { describe, expect, it } from "vitest";

import { getWebBuildIdentity } from "./build-identity";

describe("web build identity", () => {
  it("exposes only its compile-time source SHA", () => {
    expect(getWebBuildIdentity.length).toBe(0);
    expect(getWebBuildIdentity()).toEqual({
      sourceSha: expect.stringMatching(/^(?:unbuilt|[0-9a-f]{7,64})$/u),
    });
  });

  it("does not trust a runtime environment SHA", () => {
    const previous = process.env.MAESTRO_SOURCE_SHA;
    process.env.MAESTRO_SOURCE_SHA = "runtime-forgery";
    try {
      expect(getWebBuildIdentity().sourceSha).not.toBe("runtime-forgery");
    } finally {
      if (previous === undefined) delete process.env.MAESTRO_SOURCE_SHA;
      else process.env.MAESTRO_SOURCE_SHA = previous;
    }
  });
});
