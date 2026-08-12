import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { meaningfulMainContentTarget } from "./saas-ui-golden";

describe("golden capture readiness targets", () => {
  it("waits for profile content instead of the settings sidebar", () => {
    const fixture = readFileSync(
      new URL("./saas-ui-golden.ts", import.meta.url),
      "utf8",
    );

    expect(fixture).toContain(
      'settings: (page) => page.getByRole("heading", { name: "Profile" })',
    );
  });

  it("uses the visible inbox row on mobile and activity on desktop", () => {
    expect(meaningfulMainContentTarget("split-inbox", 390)).toBe("inbox-row");
    expect(meaningfulMainContentTarget("split-inbox", 1440)).toBe("activity");
    expect(meaningfulMainContentTarget("list-detail", 390)).toBe("activity");
  });
});
