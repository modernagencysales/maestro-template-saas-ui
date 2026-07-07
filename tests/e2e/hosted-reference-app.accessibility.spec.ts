import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

const expectNoAxeViolations = async (
  page: import("@playwright/test").Page,
  label: string,
) => {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));

  expect(violations, `${label} has axe violations`).toEqual([]);
};

test.describe("hosted reference app accessibility", () => {
  test("exposes landmarks, skip link, and live status", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute("href", "#template-main-content");
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
    await expect(page.locator("#template-main-content")).toHaveAttribute(
      "id",
      "template-main-content",
    );
    await expect(
      page.locator(".template-live-region", { hasText: "Viewing Overview" }),
    ).toBeAttached();
    await expectNoAxeViolations(page, "Overview");
  });

  test("keeps route navigation operable and announces route changes", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });

    await nav.getByRole("link", { name: "Data Lifecycle" }).click();
    await expect(
      page.getByRole("heading", { name: "Data lifecycle" }),
    ).toBeVisible();
    await expect(
      page.locator(".template-live-region", {
        hasText: "Viewing Data Lifecycle",
      }),
    ).toBeAttached();
    await expect(page.locator("#template-main-content")).toBeFocused();
    await expectNoAxeViolations(page, "Data lifecycle");
  });
});
