import { expect, test } from "./fixtures/saas-ui-golden-test";
import {
  acceptanceEntries,
  captureReferenceAndGenerated,
  gotoGolden,
  waitForGoldenCaptureReady,
} from "./fixtures/saas-ui-golden";

test.describe("paired Saas UI golden visual evidence", () => {
  test.describe("mobile shell geometry", () => {
    test.beforeEach(({ page: _page }, testInfo) => {
      void _page;
      testInfo.skip(
        testInfo.project.name !== "mobile-chromium",
        "Mobile shell geometry is mobile-scoped.",
      );
    });

    test.use({ viewport: { width: 320, height: 800 } });

    test("reserves a lane for the sidebar trigger", async ({ page }) => {
      for (const kind of ["reference", "generated"] as const) {
        await gotoGolden({ page, kind, route: "/dashboard" });

        const trigger = page.getByRole("button", { name: "Open sidebar" });
        const search = page.getByRole("searchbox", { name: "Search" });
        await expect(trigger).toBeVisible();
        await expect(search).toBeVisible();
        const [triggerRect, searchRect] = await Promise.all([
          trigger.evaluate((element) => {
            const { x, width } = element.getBoundingClientRect();
            return { x, width };
          }),
          search.evaluate((element) => {
            const { x } = element.getBoundingClientRect();
            return { x };
          }),
        ]);

        expect(searchRect.x).toBeGreaterThanOrEqual(
          triggerRect.x + triggerRect.width + 8,
        );
      }
    });

    test("keeps page headings clear of the sidebar trigger", async ({
      page,
    }) => {
      for (const kind of ["reference", "generated"] as const) {
        await gotoGolden({ page, kind, route: "/contacts" });

        const trigger = page.getByRole("button", { name: "Open sidebar" });
        const heading = page.getByRole("heading", {
          name: "Contacts",
          exact: true,
        });
        await expect(trigger).toBeVisible();
        await expect(heading).toBeVisible();
        const [triggerRect, headingRect] = await Promise.all([
          trigger.boundingBox(),
          heading.boundingBox(),
        ]);

        expect(triggerRect).not.toBeNull();
        expect(headingRect).not.toBeNull();
        if (!triggerRect || !headingRect) {
          throw new Error(
            "Expected the trigger and page heading to have bounds",
          );
        }
        expect(
          triggerRect.x + triggerRect.width <= headingRect.x ||
            headingRect.x + headingRect.width <= triggerRect.x ||
            triggerRect.y + triggerRect.height <= headingRect.y ||
            headingRect.y + headingRect.height <= triggerRect.y,
        ).toBe(true);
      }
    });
  });

  test("dark mode changes computed theme and screenshot evidence", async ({
    page,
  }) => {
    await gotoGolden({
      page,
      kind: "generated",
      route: "/dashboard",
      colorMode: "light",
    });
    await waitForGoldenCaptureReady({
      page,
      fixture: "ready-read",
      composition: "app-shell",
    });
    const lightTheme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        colorScheme: root.colorScheme,
        className: document.documentElement.className,
        bodyBackground: body.backgroundColor,
        chakraBackground: root.getPropertyValue("--chakra-colors-bg").trim(),
      };
    });
    const lightScreenshot = await page.screenshot({ animations: "disabled" });

    await gotoGolden({
      page,
      kind: "generated",
      route: "/dashboard",
      colorMode: "dark",
    });
    await waitForGoldenCaptureReady({
      page,
      fixture: "ready-read",
      composition: "app-shell",
    });
    const darkTheme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        colorScheme: root.colorScheme,
        className: document.documentElement.className,
        bodyBackground: body.backgroundColor,
        chakraBackground: root.getPropertyValue("--chakra-colors-bg").trim(),
      };
    });
    const darkScreenshot = await page.screenshot({ animations: "disabled" });

    expect(lightTheme.colorScheme).toBe("light");
    expect(darkTheme.colorScheme).toBe("dark");
    expect(darkTheme.className).toContain("dark");
    expect(darkTheme).not.toEqual(lightTheme);
    expect(darkScreenshot).not.toEqual(lightScreenshot);
  });

  for (const colorMode of ["light", "dark"] as const) {
    for (const entry of acceptanceEntries) {
      test(`${entry.id} ready-read ${colorMode} captures both authorities`, async ({
        page,
      }) => {
        await captureReferenceAndGenerated({
          page,
          route: entry.route,
          fixture: "ready-read",
          colorMode,
          composition: entry.id,
        });
      });
    }
  }

  for (const fixture of [
    "loading",
    "empty",
    "ready-edit",
    "mutation-success",
    "mutation-failure",
    "error",
    "not-found",
    "permission-denied",
  ] as const) {
    for (const colorMode of ["light", "dark"] as const) {
      test(`states ${fixture} ${colorMode} captures both authorities`, async ({
        page,
      }) => {
        await captureReferenceAndGenerated({
          page,
          route: "/states",
          fixture,
          colorMode,
          composition: "states",
        });
      });
    }
  }
});
