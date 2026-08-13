import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("parity@saas-ui.dev");
  await page.locator('input[type="password"]').fill("DemoPassword123");
  await page.getByRole("button", { name: "Log in" }).click();
});

test("exposes Kanban and Showcase from the workspace sidebar", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Kanban" }).click();
  await expect(page).toHaveURL(/\/awesome-inc\/kanban$/u);
  await expect(page.getByRole("heading", { name: "Kanban" })).toBeVisible();
  await page.getByRole("link", { name: "Showcase" }).click();
  await expect(page).toHaveURL(/\/awesome-inc\/showcase$/u);
  await expect(
    page.getByRole("heading", { name: "Pro surfaces" }),
  ).toBeVisible();
});

test("opens and closes the showcase drawer and modal", async ({ page }) => {
  await page.goto("/awesome-inc/showcase");
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(
    page.getByRole("heading", { name: "Add contact" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeFocused();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
});
