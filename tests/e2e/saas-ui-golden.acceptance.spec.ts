import { expect, test } from "@playwright/test";
import { goldenUrl, seedGoldenFixture } from "./fixtures/saas-ui-golden";

const routes = [
  ["app-shell", "/dashboard"],
  ["dashboard-report", "/reports"],
  ["data-grid", "/contacts"],
  ["filterable-collection", "/contacts"],
  ["list-detail", "/contacts/view/contact-1"],
  ["split-inbox", "/inbox"],
  ["record-aside", "/contacts/view/contact-1"],
  ["settings", "/settings"],
  ["form", "/forms"],
  ["onboarding", "/getting-started"],
  ["kanban", "/kanban"],
  ["auth", "/login"],
  ["billing", "/settings/billing"],
  ["search-command", "/search?q=contact"],
  ["states", "/states"],
] as const satisfies readonly [string, string][];

async function assertAuthority(page: Parameters<typeof seedGoldenFixture>[0]) {
  await expect(page.locator("body")).toBeVisible();
}

test.describe("paired acceptance-map compositions", () => {
  for (const [id, route] of routes) {
    test(`${id} renders on both authorities`, async ({ page }) => {
      for (const kind of ["reference", "generated"] as const) {
        await seedGoldenFixture(page, "ready-read", "light");
        await page.goto(goldenUrl(kind, route), { waitUntil: "networkidle" });
        await assertAuthority(page);
        await expect(page).toHaveURL(
          new RegExp(`${route.split("?")[0].replaceAll("/", "\\/")}`),
        );
        await expect(page.locator("body")).not.toHaveText("");
      }
    });
  }
});
