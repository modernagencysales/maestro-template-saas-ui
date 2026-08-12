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
      const routeSearch = page.getByPlaceholder("Search your workspace...");
      await routeSearch.fill("contact");
      await expect(page).toHaveURL(/search\?q=contact/);
      await expect(
        page.getByRole("heading", { name: "No results" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Clear search" }).click();
      await expect(
        page.getByRole("heading", { name: "Recent searches" }),
      ).toBeVisible();
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
      const selectionAction = page.getByText("21 selected", { exact: true });
      await expect(selectionAction).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add tags" }),
      ).toBeVisible();
      const action = page.waitForEvent("console", {
        predicate: (message) => message.text().startsWith("Add tags"),
      });
      await page.getByRole("button", { name: "Add tags" }).press("Enter");
      const selectedIds = await (await action).args()[1]?.jsonValue();
      expect(selectedIds).toContain("contact-21");
      await checkbox.uncheck({ force: true });
      await expect(selectionAction).toHaveCount(0);
      await expect(checkbox).not.toBeChecked();
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
      await page.getByRole("button", { name: "Billing" }).click();
      await expect(page).toHaveURL(/settings\/billing/);
      await expect(
        page.getByRole("heading", { name: "Billing", exact: true }),
      ).toBeVisible();
    });

    test(`${kind} report period selection changes the active period`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("dashboard-report").route });
      const previousPeriod = page.getByText("Year to date", { exact: true });
      await expect(previousPeriod).toHaveAttribute("data-state", "checked");
      const period = page.getByText("Last 7 days", { exact: true });
      await period.click();
      await expect(period).toHaveAttribute("data-state", "checked");
      await expect(previousPeriod).toHaveAttribute("data-state", "unchecked");
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
        page.getByText("Changes saved successfully", { exact: true }),
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
      const createWorkspace = page.getByRole("button", {
        name: "Create workspace",
      });
      await page.getByRole("textbox", { name: "Workspace name" }).focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(createWorkspace).toBeDisabled();
      await page
        .getByRole("textbox", { name: "Workspace name" })
        .fill("Golden workspace");
      await page
        .getByRole("textbox", { name: "Workspace URL" })
        .fill("golden-workspace");
      await expect(createWorkspace).toBeEnabled();
      await createWorkspace.click();
      await expect(
        page.getByRole("heading", {
          name: /Choose your style|Create a new workspace/i,
        }),
      ).toBeVisible();
    });

    test(`${kind} drags a Kanban card between columns`, async ({ page }) => {
      await gotoGolden({ page, kind, route: entry("kanban").route });
      const origin = page.locator('[data-column="status:active"]');
      const destination = page.locator('[data-column="status:inactive"]');
      const card = origin.locator('[data-id="contact-1"]');
      await expect(card).toContainText("Jordan Lee");
      const sourceBox = await card.boundingBox();
      const targetBox = await destination.boundingBox();
      if (!sourceBox || !targetBox) throw new Error("Kanban card not visible");
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 20 },
      );
      await page.mouse.up();
      await expect(origin.locator('[data-id="contact-1"]')).toHaveCount(0);
      await expect(destination.locator('[data-id="contact-1"]')).toContainText(
        "Jordan Lee",
      );
    });

    test(`${kind} auth form validates credentials and preserves input`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("auth").route });
      const email = page.getByRole("textbox", { name: "Email" });
      await email.fill("invalid");
      await email.press("Tab");
      await expect(email).toHaveValue("invalid");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(
        page.getByRole("button", { name: "Log in", exact: true }),
      ).toBeDisabled();
    });

    test(`${kind} billing validates email before an update`, async ({
      page,
    }) => {
      await gotoGolden({ page, kind, route: entry("billing").route });
      const email = page.getByRole("textbox", { name: "Email address" });
      await email.fill("invalid");
      await email.press("Tab");
      await expect(email).toHaveValue("invalid");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("button", { name: "Update" })).toBeDisabled();
    });

    for (const [fixture, action, result] of [
      ["ready-edit", "Save changes", "Changes saved successfully"],
      ["mutation-failure", "Try again", "Changes saved successfully"],
      ["error", "Retry", "Loading workspace data"],
      ["not-found", "Back to records", "Records are ready to review"],
      ["permission-denied", "Request access", "Access request sent"],
    ] as const) {
      test(`${kind} ${fixture} state performs its recovery action`, async ({
        page,
      }) => {
        await gotoGolden({ page, kind, route: "/states", fixture });
        await page.getByRole("button", { name: action }).click();
        await expect(page.getByText(result, { exact: true })).toBeVisible();
      });
    }
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
