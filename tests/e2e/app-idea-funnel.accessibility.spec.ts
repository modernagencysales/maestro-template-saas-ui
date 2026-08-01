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

const expectResponsiveAt = async (page: Page, label: string) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expectAccessible(page, `${label} at 200% text size`);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
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

test("every stable funnel surface is accessible and responsive", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("maestro-template.cookie-consent", "declined");
  });

  await page.goto("/");
  await expectResponsiveAt(page, "landing");
  await page.goto("/evaluate");
  await expectResponsiveAt(page, "intake");
  await completeEvaluation(page);
  await expect(page.getByText("Your app idea verdict")).toBeVisible();
  await expectResponsiveAt(page, "report");

  await page.goto("/library");
  await expect(page.getByRole("link", { name: "Open report" })).toBeVisible();
  await expectResponsiveAt(page, "library");
  await page.getByRole("link", { name: "Open report" }).click();
  await page.getByRole("link", { name: "Get the Complete Build Pack" }).click();
  await expectResponsiveAt(page, "checkout");

  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();
  await page.getByRole("button", { name: "Pay $29.00" }).click();
  await page.getByRole("link", { name: "Generate my Build Pack" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Turning your idea into a build-ready plan.",
    }),
  ).toBeVisible();
  await expectResponsiveAt(page, "Build Pack progress");

  await expect(
    page.getByRole("heading", { name: "Your idea is ready to hand off." }),
  ).toBeVisible();
  await expectResponsiveAt(page, "Build Pack");
  await page
    .getByRole("link", { name: "See how Maestro could build this" })
    .click();
  await expectResponsiveAt(page, "Maestro offer");
});
