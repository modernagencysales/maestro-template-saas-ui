import { expect, test } from "@playwright/test";

test.describe("hosted reference app visual coverage", () => {
  test("matches the Saas UI business dashboard first viewport", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Revenue workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Priority accounts")).toBeVisible();
    await expect(page.getByText("Golden path")).toBeVisible();

    const shell = await page.locator(".template-shell-content").boundingBox();

    expect(shell?.width ?? 0).toBeGreaterThan(280);
    expect(shell?.height ?? 0).toBeGreaterThan(420);

    await expect(page).toHaveScreenshot("saas-dashboard-first-viewport.png", {
      animations: "disabled",
      fullPage: false,
      maxDiffPixelRatio: 0.03,
    });
  });

  test("matches the data lifecycle mutation route", async ({ page }) => {
    await page.goto("/data-lifecycle");

    await expect(
      page.getByRole("heading", { name: "Data lifecycle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "DSAR request plans" }),
    ).toBeVisible();

    await expect(page).toHaveScreenshot("saas-data-lifecycle-route.png", {
      animations: "disabled",
      fullPage: false,
      maxDiffPixelRatio: 0.03,
    });
  });
});
