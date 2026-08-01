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

test("anonymous idea through paid Build Pack and Maestro handoff", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Roast my app idea" }).first().click();
  await completeEvaluation(page);

  await expect(page.getByText("Your app idea verdict")).toBeVisible();
  await expect(
    page.getByText("What it will take", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get the Complete Build Pack" }).click();
  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Secure test checkout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pay $29.00" }).click();
  await expect(page.getByText("Payment confirmed")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.localStorage)))
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^maestro\.idea-evaluation\.idea_/),
        "maestro.idea-funnel.commerce",
      ]),
    );
  await page.getByRole("link", { name: "Generate my Build Pack" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reportId = window.location.pathname.split("/")[2] ?? "";
        const commerce = JSON.parse(
          window.localStorage.getItem("maestro.idea-funnel.commerce") ?? "{}",
        ) as {
          entitlements?: { reportId: string; status: string }[];
        };
        return {
          evaluationPresent:
            window.localStorage.getItem(
              `maestro.idea-evaluation.${reportId}`,
            ) !== null,
          entitlementStatus:
            commerce.entitlements?.find((item) => item.reportId === reportId)
              ?.status ?? "missing",
        };
      }),
    )
    .toEqual({ evaluationPresent: true, entitlementStatus: "active" });

  await expect(
    page.getByRole("heading", { name: "Your idea is ready to hand off." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "See how Maestro could build this" })
    .click();
  await expect(page.getByText("$29.00 Maestro credit")).toBeVisible();
});

test("saved reports remain available in the library", async ({ page }) => {
  await page.goto("/evaluate");
  await completeEvaluation(page);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your app ideas" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open report" })).toBeVisible();
  await page.getByRole("button", { name: "Create share link" }).click();
  await expect(
    page.getByRole("button", { name: "Revoke share link" }),
  ).toBeVisible();
  const shareHref = await page
    .getByRole("link", { name: "Open share link" })
    .getAttribute("href");
  expect(shareHref).toMatch(/^\/share\/share_idea_/);
  const publicPage = await page.context().newPage();
  await publicPage.goto(shareHref ?? "/share/missing");
  await expect(
    publicPage.getByText("Shared Buildability Report"),
  ).toBeVisible();
  await publicPage.close();
  await page.getByRole("button", { name: "Revoke share link" }).click();
  await page.goto(shareHref ?? "/share/missing");
  await expect(
    page.getByText("This shared report is unavailable"),
  ).toBeVisible();
});
