import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const primaryNav = async (page: Page) => {
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  return nav;
};

test.describe("hosted reference app", () => {
  test("renders the Saas UI business workspace shell", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Maestro Template/);
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#template-main-content");
    await expect(
      page.locator(".template-live-region", { hasText: "Viewing Overview" }),
    ).toBeAttached();
    await expect(page.locator(".template-toast-region")).toBeAttached();
    await expect(
      page.getByRole("heading", { name: "Revenue workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Priority accounts")).toBeVisible();
    await expect(page.getByText("Golden path")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Live workflow runs" }),
    ).toBeVisible();
  });

  test("keeps route navigation mounted and route-specific", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = await primaryNav(page);

    const routeExpectations = [
      ["Overview", "Revenue workspace"],
      ["Brain", "Brain"],
      ["Workflows", "Workflows"],
      ["Capabilities", "Capabilities"],
      ["Agents", "Team"],
      ["Runs", "Runs"],
      ["Documents", "Documents"],
      ["Sources", "Accounts"],
      ["Integrations", "Integrations"],
      ["API / CLI / MCP", "API"],
      ["Onboarding", "Onboarding"],
      ["Data Map", "Data map"],
      ["Data Lifecycle", "Data lifecycle"],
      ["Notifications", "Notifications"],
      ["Settings", "Settings"],
      ["Legal", "Legal"],
      ["Billing", "Billing"],
      ["Analytics", "Analytics"],
      ["Health", "Health"],
      ["Admin", "Admin"],
    ] as const;

    for (const [label, heading] of routeExpectations) {
      await nav.getByRole("link", { name: label }).click();
      await expect(
        page.getByRole("heading", { exact: true, name: heading }),
      ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: label }),
        `${label} should mark its route active`,
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("shows the live-data proof in every backend posture", async ({
    page,
  }) => {
    await page.goto("/");

    const panel = page.getByRole("region", { name: "Live workflow runs" });
    await expect(
      panel.getByRole("heading", { name: "Live workflow runs" }),
    ).toBeVisible();

    await expect(
      panel
        .getByText("Streaming from workspace")
        .or(panel.getByText("No Convex deployment configured"))
        .or(panel.getByText("Demo workspace not seeded"))
        .or(panel.getByText("Live backend unavailable"))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("exercises the fake-safe Confect mutation route", async ({ page }) => {
    await page.goto("/");
    const nav = await primaryNav(page);

    await nav.getByRole("link", { name: "Data Lifecycle" }).click();
    await expect(
      page.getByRole("heading", { name: "Data lifecycle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "DSAR request plans" }),
    ).toBeVisible();
    await expect(page.getByText("Fake-safe local mode")).toBeVisible();

    await page.getByRole("button", { name: "Plan export" }).click();
    await expect(page.getByText(/dsar_export_/)).toBeVisible();
    await expect(
      page.getByText("DSAR dry-run planned", { exact: true }),
    ).toBeVisible();
  });
});
