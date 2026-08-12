import { expect, test } from "./fixtures/saas-ui-golden-test";
import { forEachGoldenAuthority } from "./fixtures/saas-ui-golden";

test.describe("paired Saas UI golden behavior", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    void _page;
    testInfo.skip(
      testInfo.project.name !== "desktop-chromium",
      "Shell keyboard assertions are desktop-scoped; mobile controls have dedicated coverage.",
    );
  });

  test("paired authorities expose the authenticated workspace shell", async ({
    page,
  }) => {
    await forEachGoldenAuthority(page, async () => {
      await expect(
        page.getByRole("heading", { name: /Good morning, Alex Morgan/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: "Search" }),
      ).toBeVisible();
    });
  });

  test("paired authorities keep the shell keyboard-operable", async ({
    page,
  }) => {
    await forEachGoldenAuthority(page, async () => {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator(":focus")).toBeVisible();
    });
  });
});
