import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const expectAccessible = async (page: Page, label: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target),
    })),
    `${label} has accessibility violations`,
  ).toEqual([]);
};

test("landing and intake have usable structure and focus", async ({ page }) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  await expectAccessible(page, "landing");

  await page.getByRole("link", { name: "Roast my app idea" }).first().click();
  await expect(page.getByLabel("Your answer")).toBeFocused();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/Write a short answer/)).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expectAccessible(page, "intake validation");
});

test("checkout and payment-pending states do not claim entitlement", async ({
  page,
}) => {
  await page.goto("/checkout/idea_unpaid");
  await expect(page.getByText("One-time purchase")).toBeVisible();
  await expectAccessible(page, "checkout");
  await page.goto(
    "/checkout/return?report_id=idea_unpaid&session_id=checkout_1",
  );
  await expect(
    page.getByRole("heading", { name: "Confirming your payment" }),
  ).toBeVisible();
  await expect(page.getByText("Build Pack unlocked")).toHaveCount(0);
  await expectAccessible(page, "payment pending");
});
