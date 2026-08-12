import type { Locator, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  meaningfulMainContentTarget,
  meaningfulReadyLocator,
} from "./saas-ui-golden";

describe("golden capture readiness targets", () => {
  it("uses the exact profile heading for settings readiness", () => {
    const locator = {} as Locator;
    const getByRole = vi.fn(() => locator);
    const getByText = vi.fn(() => ({}) as Locator);

    expect(
      meaningfulReadyLocator(
        { getByRole, getByText } as unknown as Page,
        "settings",
      ),
    ).toBe(locator);
    expect(getByRole).toHaveBeenCalledExactlyOnceWith("heading", {
      name: "Profile",
      exact: true,
    });
    expect(getByText).not.toHaveBeenCalled();
  });

  it("uses the visible inbox row on mobile and activity on desktop", () => {
    expect(meaningfulMainContentTarget("split-inbox", 390)).toBe("inbox-row");
    expect(meaningfulMainContentTarget("split-inbox", 1440)).toBe("activity");
    expect(meaningfulMainContentTarget("list-detail", 390)).toBe("activity");
  });
});
