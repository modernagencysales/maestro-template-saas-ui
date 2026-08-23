import { describe, expect, it } from "vitest";

import { isAdvancingSnapshotVersion } from "../confect/brain/snapshotVersion";

describe("Brain editor snapshot revision fence", () => {
  it("accepts only newer positive safe-integer versions", () => {
    expect(isAdvancingSnapshotVersion(undefined, 1)).toBe(true);
    expect(isAdvancingSnapshotVersion(1, 2)).toBe(true);

    expect(isAdvancingSnapshotVersion(2, 2)).toBe(false);
    expect(isAdvancingSnapshotVersion(2, 1)).toBe(false);
    expect(isAdvancingSnapshotVersion(undefined, 0)).toBe(false);
    expect(isAdvancingSnapshotVersion(undefined, 1.5)).toBe(false);
    expect(
      isAdvancingSnapshotVersion(undefined, Number.MAX_SAFE_INTEGER + 1),
    ).toBe(false);
  });
});
