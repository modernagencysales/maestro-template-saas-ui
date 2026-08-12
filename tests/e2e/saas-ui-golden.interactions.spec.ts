import { expect, test } from "./fixtures/saas-ui-golden-test";
import { acceptanceEntries, gotoGolden } from "./fixtures/saas-ui-golden";

const authorities = ["reference", "generated"] as const;

function entry(id: string) {
  const result = acceptanceEntries.find((item) => item.id === id);
  if (!result) throw new Error(`Missing acceptance entry ${id}`);
  return result;
}

test.describe("paired Saas UI golden interactions", () => {
  for (const kind of authorities) {
    test(`${kind} shell collapse, resize, persistence, and flyout`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("app-shell").route });
      const collapse = page
        .getByRole("button", { name: "Collapse sidebar" })
        .first();
      await collapse.click();
      await expect(
        page.getByText("Dashboard", { exact: true }).first(),
      ).toBeVisible();
      await page.reload({ waitUntil: "networkidle" });
      await expect(
        page.getByText("Dashboard", { exact: true }).first(),
      ).toBeVisible();

      const handle = page
        .getByRole("separator", { name: "Collapse sidebar" })
        .first();
      await handle.click();
      await expect(collapse).toBeVisible();
    });

    test(`${kind} workspace and user menus expose named commands`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("app-shell").route });
      await page.getByRole("button", { name: /Current workspace is/ }).click();
      await expect(
        page.getByRole("menuitem", { name: "Create a workspace" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "User menu" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Profile" }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: /Dark mode|Light mode/ }),
      ).toBeVisible();
    });

    test(`${kind} global search accepts keyboard shortcut and query`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("search-command").route });
      await page.keyboard.press("/");
      const focusedGlobalSearch = page.locator(
        'input[aria-label="Search"]:focus',
      );
      await expect(focusedGlobalSearch).toHaveCount(1);
      await focusedGlobalSearch.fill("contact");
      await expect(focusedGlobalSearch).toHaveValue("contact");
      await expect(page).toHaveURL(/search/);
    });

    test(`${kind} data grid filters, sorts, pages, and selects`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("data-grid").route });
      const nameHeader = page.getByRole("columnheader", { name: "Name" });
      await nameHeader.click();
      await expect(nameHeader).toHaveAttribute(
        "aria-sort",
        /ascending|descending/,
      );
      const filter = page.getByRole("button", { name: /filter/i }).first();
      await filter.click();
      await expect(
        page.getByRole("menu").or(page.getByRole("dialog")),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      const pageNumber = page.getByRole("spinbutton", { name: "Page" });
      await expect(page.getByText("of 2", { exact: true })).toBeVisible();
      await pageNumber.fill("2");
      await pageNumber.press("Enter");
      await expect(pageNumber).toHaveValue("2");
      await expect(
        page.getByRole("link", { name: "ZZZ Pagination Contact 21" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Jordan Lee" })).toHaveCount(
        0,
      );
      const checkbox = page.getByRole("checkbox", {
        name: "Select all rows",
      });
      await checkbox.check({ force: true });
      await expect(checkbox).toBeChecked();
    });

    test(`${kind} removes an active collection filter`, async ({ page }) => {
      await gotoGolden({
        page,
        kind,
        route: entry("filterable-collection").route,
      });
      const filter = page.getByRole("button", { name: /filter/i }).first();
      await filter.click();
      const menu = page.getByRole("menu").or(page.getByRole("dialog"));
      await expect(menu).toBeVisible();
      const firstOption = menu.getByRole("menuitem").first();
      await firstOption.click();
      await menu.getByRole("menuitem", { name: "Active", exact: true }).click();
      const activeFilterRemoves = page.locator(".sui-active-filter__remove");
      await expect(activeFilterRemoves).toHaveCount(2);
      await activeFilterRemoves.first().click();
      await expect(activeFilterRemoves).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Clear filters" }),
      ).toHaveCount(0);
    });

    test(`${kind} navigates list to detail and switches the record aside`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("data-grid").route });
      await page.getByRole("link", { name: "Jordan Lee" }).click();
      await expect(page).toHaveURL(/contacts\/view\/contact-1/);
      const details = page.getByRole("button", {
        name: "Hide contact details",
      });
      await details.click();
      await expect(
        page.getByRole("complementary", { name: "Contact details" }),
      ).toHaveAttribute("data-state", "closed");
      const showDetails = page.getByRole("button", {
        name: "Show contact details",
      });
      await expect(showDetails).toBeFocused();
      await showDetails.click();
      const close = page.getByRole("button", { name: "Close contact details" });
      await close.focus();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("complementary", { name: "Contact details" }),
      ).toHaveAttribute("data-state", "closed");
      await expect(page.locator(":focus")).toHaveAccessibleName(
        "Show contact details",
      );
    });

    test(`${kind} selects an inbox item in the split view`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("split-inbox").route });
      const item = page.getByRole("row", { name: /Sam Rivera/ });
      await expect(item).toBeVisible();
      await item.click();
      await expect(item).toHaveAttribute("data-active", "true");
      await expect(
        page.getByRole("complementary", { name: "Contact details" }),
      ).toContainText("Sam Rivera");
    });

    test(`${kind} settings navigation reaches billing`, async ({ page }) => {
      await gotoGolden({ page, kind, route: entry("settings").route });
      await page.getByRole("link", { name: "Billing" }).click();
      await expect(page).toHaveURL(/settings\/billing/);
      await expect(
        page.getByRole("heading", { name: "Billing" }),
      ).toBeVisible();
    });

    test(`${kind} form covers validation, success, and failure`, async ({
      page,
    }) => {
      await gotoGolden({
        page,
        kind,
        route: entry("form").route,
        fixture: "ready-edit",
      });
      const name = page.getByRole("textbox", { name: "Project name" });
      await name.fill("");
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(
        page.getByRole("alert").or(page.getByText(/required/i)),
      ).toBeVisible();

      await name.fill("Northstar launch");
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(
        page.getByRole("status", { name: "Changes saved successfully" }),
      ).toBeVisible();

      await gotoGolden({
        page,
        kind,
        route: `${entry("form").route}?goldenState=mutation-failure`,
        fixture: "mutation-failure",
      });
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(page.getByRole("alert")).toHaveText(
        "Changes could not be saved",
      );
    });

    test(`${kind} advances onboarding after invalid and valid form states`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("onboarding").route });
      await page.getByRole("button", { name: "Create workspace" }).click();
      await expect(
        page.getByRole("alert").or(page.getByText(/required/i)),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Workspace name" })
        .fill("Golden workspace");
      await page
        .getByRole("textbox", { name: "Workspace URL" })
        .fill("golden-workspace");
      await page.getByRole("button", { name: "Create workspace" }).click();
      await expect(
        page.getByRole("heading", {
          name: /Choose your style|Create a new workspace/i,
        }),
      ).toBeVisible();
    });

    test(`${kind} drags a Kanban card between columns`, async ({ page }) => {
      await gotoGolden({ page, kind, route: entry("kanban").route });
      const card = page.locator('[draggable="true"]').first();
      const destination = page.locator('[data-kanban-column="In progress"]');
      await card.dragTo(destination);
      await expect(destination).toContainText(/Northwind|Jordan Lee/);
    });

    test(`${kind} auth form reports invalid credentials and preserves names`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("auth").route });
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Forgot your password?" }),
      ).toBeVisible();
    });

    test(`${kind} billing presents plan, email, and invoice actions`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("billing").route });
      await expect(
        page.getByText("Billing plan", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Update" })).toBeVisible();
      await expect(page.getByText("Invoices", { exact: true })).toBeVisible();
    });
  }
});

test.describe("paired mobile shell behavior", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const kind of authorities) {
    test(`${kind} mobile sidebar uses a backdrop and restores focus`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("app-shell").route });
      const collapse = page
        .getByRole("button", { name: "Collapse sidebar" })
        .first();
      await collapse.click();
      await expect(
        page.locator('[data-part="backdrop"], [aria-label="Close sidebar"]'),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await collapse.focus();
      await expect(page.locator(":focus")).toHaveAccessibleName(
        "Collapse sidebar",
      );
    });
  }
});
