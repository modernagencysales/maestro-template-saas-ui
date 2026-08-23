import { describe, expect, it } from "vitest";

import { toTagOption } from "./use-tags";

describe("toTagOption", () => {
  it("adapts the API tag name to the Starter picker label", () => {
    expect(
      toTagOption({ id: "tag_1", name: "Priority", color: null }),
    ).toEqual({ id: "tag_1", label: "Priority", color: undefined });
  });
});
