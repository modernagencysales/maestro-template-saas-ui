import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("parity@saas-ui.dev");
  await page.locator('input[type="password"]').fill("DemoPassword123");
  await page.locator('input[type="password"]').press("Tab");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
});

test("exposes Kanban and Showcase from the workspace sidebar", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Kanban" }).click();
  await expect(page).toHaveURL(/\/awesome-inc\/kanban$/u);
  await expect(page.getByRole("heading", { name: "Kanban" })).toBeVisible();
  await page.getByRole("button", { name: "Showcase" }).click();
  await expect(page).toHaveURL(/\/awesome-inc\/showcase$/u);
  await expect(
    page.getByRole("heading", { name: "Pro surfaces" }),
  ).toBeVisible();
});

test("reorders a Kanban card by drag and drop", async ({ page }) => {
  await page.goto("/awesome-inc/kanban");
  const source = page.getByTestId("kanban-card-task-1");
  const target = page.getByTestId("kanban-column-done");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Kanban cards are not visible");
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("kanban-column-done")).toContainText(
    "Import workspace sources",
  );
});

test("keeps every Kanban column inside the mobile viewport", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/awesome-inc/kanban");
  const columns = page.getByTestId(/^kanban-column-/u);
  await expect(columns).toHaveCount(2);
  for (const column of await columns.all()) {
    const box = await column.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Kanban column is not visible");
    expect(box.width).toBeGreaterThan(300);
    expect(box.x + box.width).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
});

test("opens and closes the showcase drawer and modal", async ({ page }) => {
  await page.goto("/awesome-inc/showcase");
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(
    page.getByRole("heading", { name: "Add contact" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeFocused();
  const feedbackTrigger = page
    .getByRole("main")
    .getByRole("button", { name: "Send feedback" });
  await feedbackTrigger.click();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Feedback" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(feedbackTrigger).toBeFocused();
});
