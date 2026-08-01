import { expect, test } from "@playwright/test";

test("public funnel visual surfaces", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot(
    `app-idea-landing-${testInfo.project.name}.png`,
    {
      fullPage: true,
      animations: "disabled",
    },
  );

  await page.goto("/evaluate");
  await expect(page).toHaveScreenshot(
    `app-idea-intake-${testInfo.project.name}.png`,
    {
      fullPage: true,
      animations: "disabled",
    },
  );

  await page.goto("/checkout/visual-fixture");
  await expect(page).toHaveScreenshot(
    `app-idea-checkout-${testInfo.project.name}.png`,
    {
      fullPage: true,
      animations: "disabled",
    },
  );
});
