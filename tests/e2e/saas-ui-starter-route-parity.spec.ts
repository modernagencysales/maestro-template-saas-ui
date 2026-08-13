import { expect, test } from "@playwright/test";

test("hides the root loader after hydration", async ({ page }) => {
  await page.goto("/login");

  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator("#app-loader")).toHaveCSS("opacity", "0");
});

test("uses the purchased starter workspace route and keeps its shell mounted", async ({
  page,
}) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("parity@saas-ui.dev");
  await page.locator('input[type="password"]').fill("DemoPassword123");
  await page.locator('input[type="password"]').press("Tab");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Contacts" }).click();
  await expect(page).toHaveURL(/\/awesome-inc\/contacts$/u);
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
});
