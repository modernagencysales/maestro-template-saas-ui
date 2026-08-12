import { describe, expect, it } from "vitest";

import { meaningfulMainContentTarget } from "./saas-ui-golden";

describe("golden capture readiness targets", () => {
  it("uses the visible inbox row on mobile and activity on desktop", () => {
    expect(meaningfulMainContentTarget("split-inbox", 390)).toBe("inbox-row");
    expect(meaningfulMainContentTarget("split-inbox", 1440)).toBe("activity");
    expect(meaningfulMainContentTarget("list-detail", 390)).toBe("activity");
  });
});
