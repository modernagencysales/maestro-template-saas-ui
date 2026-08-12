import { expect, test } from "./fixtures/saas-ui-golden-test";
import {
  acceptanceEntries,
  captureReferenceAndGenerated,
  gotoGolden,
  waitForGoldenCaptureReady,
} from "./fixtures/saas-ui-golden";

test.describe("paired Saas UI golden visual evidence", () => {
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
