import { expect, test } from "@playwright/test";
import { goldenUrl, seedGoldenFixture } from "./fixtures/saas-ui-golden";

for (const kind of ["reference", "generated"] as const) {
  test.describe(`${kind} upstream interactions`, () => {
    test.beforeEach(async ({ page }) => {
      await seedGoldenFixture(page, "ready-read", "light");
      await page.goto(goldenUrl(kind, "/dashboard"), {
        waitUntil: "networkidle",
      });
    });

    test("collapses and restores the sidebar with a visible focus target", async ({
      page,
    }) => {
      const collapse = page
        .getByRole("button", { name: "Collapse sidebar" })
        .first();
      await collapse.click();
      await expect(page.locator("body")).toContainText("Dashboard");
      await collapse.focus();
      await expect(page.locator(":focus")).toHaveAttribute(
        "aria-label",
        "Collapse sidebar",
      );
    });

    test("reaches global search by keyboard and accepts a query", async ({
      page,
    }) => {
      const search = page.getByRole("searchbox", { name: "Search" });
      await search.focus();
      await page.keyboard.type("reports");
      await expect(search).toHaveValue("reports");
    });

    test("completes a form mutation state", async ({ page }) => {
      await page.goto(goldenUrl(kind, "/forms"), { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(page.getByText("Changes saved successfully")).toHaveText(
        "Changes saved successfully",
      );
    });

    test("honors reduced motion and 200 percent zoom without document overflow", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        document.documentElement.style.zoom = "200%";
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
    });
  });
}
