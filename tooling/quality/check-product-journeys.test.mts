import { describe, expect, it } from "vitest";
import { descriptor } from "./check-product-journeys.mts";

describe("check:product-journeys", () => {
  it("pins the canonical command and journey package", () => {
    expect(descriptor.name).toBe("check:product-journeys");
    expect(descriptor.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "package.json",
          includes: expect.arrayContaining(["check:product-journeys"]),
        }),
      ]),
    );
  });
});
