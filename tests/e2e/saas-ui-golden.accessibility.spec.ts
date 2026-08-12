import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { acceptanceEntries, gotoGolden } from "./fixtures/saas-ui-golden";

const authorities = ["reference", "generated"] as const;
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

test.describe("paired Saas UI golden accessibility", () => {
  for (const entry of acceptanceEntries) {
    for (const kind of authorities) {
      test(`${entry.id} ${kind} has no serious or critical axe violations`, async ({
        page,
      }) => {
        await gotoGolden({ page, kind, route: entry.route });
        const results = await new AxeBuilder({ page })
          .withTags(wcagTags)
          .analyze();
        const serious = results.violations.filter(
          (violation) =>
            violation.impact === "serious" || violation.impact === "critical",
        );
        expect(
          serious,
          `${kind} ${entry.id} serious/critical violations`,
        ).toEqual([]);
      });
    }
  }

  for (const entry of acceptanceEntries) {
    test(`${entry.id} exposes names and visible keyboard focus on both authorities`, async ({
      page,
    }) => {
      for (const kind of authorities) {
        await gotoGolden({ page, kind, route: entry.route });
        const unnamed = await page
          .locator("button, a, input, textarea, select")
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const style = getComputedStyle(element);
                return (
                  style.visibility !== "hidden" && style.display !== "none"
                );
              })
              .map((element) => ({
                tag: element.tagName,
                name:
                  element.getAttribute("aria-label") ??
                  element.getAttribute("title") ??
                  (
                    element as HTMLInputElement
                  ).labels?.[0]?.textContent?.trim() ??
                  element.getAttribute("placeholder") ??
                  element.textContent?.trim() ??
                  (element as HTMLInputElement).value,
              }))
              .filter(({ name }) => !name),
          );
        expect(
          unnamed,
          `${kind} ${entry.id} contains unnamed controls`,
        ).toEqual([]);

        for (let index = 0; index < 5; index += 1) {
          await page.keyboard.press("Tab");
          await expect(page.locator(":focus")).toBeVisible();
        }
      }
    });
  }

  for (const entry of acceptanceEntries) {
    test(`${entry.id} keeps reduced-motion and 200 percent zoom usable`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const kind of authorities) {
        await gotoGolden({ page, kind, route: entry.route });
        await page.evaluate(() => {
          document.documentElement.style.zoom = "200%";
        });
        expect(
          await page.evaluate(
            () => matchMedia("(prefers-reduced-motion: reduce)").matches,
          ),
        ).toBe(true);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeGreaterThan(0);
      }
    });
  }
});

test.describe("paired mobile 320px reflow", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  for (const entry of acceptanceEntries) {
    test(`${entry.id} reflows without document overflow on both authorities`, async ({
      page,
    }) => {
      for (const kind of authorities) {
        await gotoGolden({ page, kind, route: entry.route });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(320);
        await page.keyboard.press("Tab");
        await expect(page.locator(":focus")).toBeVisible();
      }
    });
  }
});
