import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import {
  collectCompatibilityFindings,
  descriptor,
} from "./check-confect-compat.mts";

describe("check:confect-compat", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("reads the machine compatibility record", async () => {
    await expect(collectCompatibilityFindings()).resolves.toEqual([]);
  });
});
