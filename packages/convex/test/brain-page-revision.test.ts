import { describe, expect, it } from "vitest";

import {
  isCurrentPageRevision,
  nextPageUpdatedAt,
} from "../confect/brain/pageRevision";

describe("Brain page optimistic revision fence", () => {
  it("accepts only the exact current revision timestamp", () => {
    expect(isCurrentPageRevision(20, 20)).toBe(true);
    expect(isCurrentPageRevision(20, 19)).toBe(false);
  });

  it("always advances even when the clock has not moved", () => {
    expect(nextPageUpdatedAt(20, 20)).toBe(21);
    expect(nextPageUpdatedAt(20, 25)).toBe(25);
  });
});
