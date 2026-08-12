import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/saas-ui-golden-test";
import {
  acceptanceEntries,
  gotoGolden,
  reducedMotionBehavior,
} from "./fixtures/saas-ui-golden";

const authorities = ["reference", "generated"] as const;
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

test.describe("paired Saas UI golden accessibility", () => {
  test("reduced motion is honored by both authorities", async ({ page }) => {
    for (const kind of authorities) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoGolden({ page, kind, route: "/dashboard" });

      const reducedMotionContract = await reducedMotionBehavior(page);

      expect(
        reducedMotionContract.matched,
        `${kind} must expose a reduced-motion CSS contract`,
      ).toBeGreaterThan(0);
      expect(reducedMotionContract.reduced).toBe(true);
    }
  });

  test("inert reduced-motion CSS does not count as behavior", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setContent(
      '<style>.probe { transition: transform 1s; } @media (prefers-reduced-motion: reduce) { .probe { color: red; } }</style><div class="probe">probe</div>',
    );
    const behavior = await reducedMotionBehavior(page);
    expect(behavior.matched).toBeGreaterThan(0);
    expect(behavior.reduced).toBe(false);
  });

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

  test("split-inbox activity editor and timeline use valid semantics", async ({
    page,
  }) => {
    const splitInbox = acceptanceEntries.find(
      (entry) => entry.id === "split-inbox",
    );
    if (!splitInbox) throw new Error("Missing split-inbox acceptance entry");

    for (const kind of authorities) {
      await gotoGolden({ page, kind, route: splitInbox.route });

      await expect(
        page.locator('[contenteditable="true"][role="textbox"]'),
      ).toHaveAccessibleName("Write your comment...");
      await expect(
        page.getByRole("list").locator('[role="listitem"]'),
      ).toHaveCount(1);
      await expect(
        page.getByRole("list").locator('[role="group"]'),
      ).toHaveCount(0);
    }
  });
});

test.describe("paired Saas UI golden data-grid semantics", () => {
  for (const kind of authorities) {
    test(`${kind} keeps sorting semantics on column headers and names row actions`, async ({
      page,
    }) => {
      const dataGrid = acceptanceEntries.find(
        (entry) => entry.id === "data-grid",
      );
      if (!dataGrid) throw new Error("Missing data-grid acceptance entry");

      await gotoGolden({ page, kind, route: dataGrid.route });

      await expect(page.locator("div[aria-sort]")).toHaveCount(0);
      await expect(page.locator('th[aria-sort="none"]')).toHaveCount(5);
      await expect(
        page.locator('[role="presentation"][aria-label]'),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Contact actions" }).first(),
      ).toBeVisible();
    });
  }
});

test.describe("paired onboarding progress semantics", () => {
  const onboarding = acceptanceEntries.find(
    (entry) => entry.id === "onboarding",
  );

  if (!onboarding) throw new Error("Missing onboarding acceptance entry");

  for (const kind of authorities) {
    test(`${kind} exposes the visual step indicator as named progress`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: onboarding.route });

      await expect(
        page.getByRole("progressbar", { name: "Onboarding step 1 of 4" }),
      ).toHaveAttribute("aria-valuenow", "1");
      await expect(page.getByRole("tablist")).toHaveCount(0);
    });
  }
});

test.describe("paired onboarding dark-mode accessibility", () => {
  const onboarding = acceptanceEntries.find(
    (entry) => entry.id === "onboarding",
  );

  if (!onboarding) throw new Error("Missing onboarding acceptance entry");

  for (const kind of authorities) {
    test(`${kind} has no serious or critical dark-mode axe violations`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        sessionStorage.setItem(
          "getting-started.workspace",
          JSON.stringify("acme"),
        );
      });
      await gotoGolden({
        page,
        kind,
        route: onboarding.route,
        colorMode: "dark",
      });
      await page.getByRole("button", { name: "Continue" }).click();
      const results = await new AxeBuilder({ page })
        .withTags(wcagTags)
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious,
        `${kind} onboarding dark-mode serious/critical violations`,
      ).toEqual([]);
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
