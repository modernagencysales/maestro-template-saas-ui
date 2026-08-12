import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { forEachGoldenAuthority } from "./fixtures/saas-ui-golden";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

test.describe("paired Saas UI golden accessibility", () => {
  test("has no serious or critical axe violations", async ({ page }) => {
    await forEachGoldenAuthority(page, async (kind) => {
      const results = await new AxeBuilder({ page })
        .withTags(wcagTags)
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious, `${kind} has serious/critical axe violations`).toEqual(
        [],
      );
    });
  });

  test("supports 320px reflow without document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await forEachGoldenAuthority(page, async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
    });
  });
});
