import { expect, test, type Page } from "@playwright/test";

const answers = [
  "ChairFill helps dental practices fill cancelled appointments.",
  "Independent dental practices with two to ten locations.",
  "Last-minute cancellations leave expensive chair time unused.",
  "Receptionists call waitlisted patients one by one.",
  "Rank and message suitable waitlist patients automatically.",
  "Matches treatment type, travel time, and patient preferences.",
  "I know three practice owners willing to pilot it.",
  "I managed operations for a five-location dental group.",
] as const;

const completeEvaluation = async (page: Page) => {
  for (const answer of answers) {
    await page.getByLabel("Your answer").fill(answer);
    await page
      .getByRole("button", { name: /Save and continue|Evaluating idea/ })
      .click();
  }
};

const capture = async (page: Page, name: string) => {
  await expect(
    page.getByRole("heading", { name: "Loading page" }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Cookie consent" }),
  ).toBeHidden();
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: "disabled",
    mask: [
      page.locator(".idea-pack-progress .idea-section-label, .idea-pack-id"),
    ],
  });
};

const captureTransient = async (page: Page, name: string) => {
  await expect(
    page.getByRole("heading", { name: "Loading page" }),
  ).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Cookie consent" }),
  ).toBeHidden();
  await page.evaluate(async () => document.fonts.ready);
  const screenshot = await page.screenshot({
    fullPage: true,
    animations: "disabled",
    mask: [
      page.locator(".idea-pack-progress .idea-section-label, .idea-pack-id"),
    ],
  });
  expect(screenshot).toMatchSnapshot(name, { maxDiffPixels: 1_000 });
};

test("public funnel visual surfaces", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("maestro-template.cookie-consent", "declined");
  });
  await page.goto("/");
  await capture(page, `app-idea-landing-${testInfo.project.name}.png`);

  await page.goto("/evaluate");
  await capture(page, `app-idea-intake-${testInfo.project.name}.png`);

  await completeEvaluation(page);
  await expect(page.getByText("Your app idea verdict")).toBeVisible();
  await capture(page, `app-idea-report-${testInfo.project.name}.png`);

  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your app ideas" }),
  ).toBeVisible();
  await capture(page, `app-idea-library-${testInfo.project.name}.png`);

  await page.getByRole("link", { name: "Open report" }).click();
  await page.getByRole("link", { name: "Get the Complete Build Pack" }).click();
  await expect(page.getByText("One-time purchase")).toBeVisible();
  await capture(page, `app-idea-checkout-${testInfo.project.name}.png`);

  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();
  await page.getByRole("button", { name: "Pay $29.00" }).click();
  await expect(
    page.getByRole("link", { name: "Generate my Build Pack" }),
  ).toBeVisible();
  await page.clock.install();
  await page.getByRole("link", { name: "Generate my Build Pack" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Turning your idea into a build-ready plan.",
    }),
  ).toBeVisible();
  await captureTransient(
    page,
    `app-idea-progress-${testInfo.project.name}.png`,
  );
  await page.clock.fastForward(700);

  await expect(
    page.getByRole("heading", { name: "Your idea is ready to hand off." }),
  ).toBeVisible();
  await capture(page, `app-idea-build-pack-${testInfo.project.name}.png`);

  await page
    .getByRole("link", { name: "See how Maestro could build this" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Build from a proven SaaS foundation." }),
  ).toBeVisible();
  await capture(page, `app-idea-maestro-${testInfo.project.name}.png`);
});
