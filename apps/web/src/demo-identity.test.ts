import { describe, expect, it } from "vitest";

import { resolveDemoIdentity } from "./demo-identity";

describe("demo identity", () => {
  it("shows product, ref, runtime mode, backend posture, and commit", () => {
    expect(
      resolveDemoIdentity({
        VITE_DEMO_PRODUCT: "Maestro Brain",
        VITE_DEMO_REF: "product/maestro-brain",
        VITE_DEMO_MODE: "fake",
        VITE_DEMO_BACKEND: "not configured",
        VITE_DEMO_COMMIT: "abc1234",
      }),
    ).toEqual({
      product: "Maestro Brain",
      ref: "product/maestro-brain",
      mode: "fake",
      backend: "not configured",
      commit: "abc1234",
    });
  });

  it("uses truthful local defaults when build metadata is absent", () => {
    expect(resolveDemoIdentity({})).toEqual({
      product: "Maestro Brain",
      ref: "unidentified build",
      mode: "local",
      backend: "unverified",
      commit: "unknown",
    });
  });
});
