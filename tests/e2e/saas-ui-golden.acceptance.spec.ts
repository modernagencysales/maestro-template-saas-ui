import { expect, test } from "./fixtures/saas-ui-golden-test";
import type { Page } from "@playwright/test";
import {
  acceptanceEntries,
  concreteRoute,
  gotoGolden,
  type AcceptanceEntry,
} from "./fixtures/saas-ui-golden";

const compositionAssertions: Record<
  string,
  (page: Page, entry: AcceptanceEntry) => Promise<void>
> = {
  "app-shell": async (page) => {
    await expect(
      page.getByRole("heading", { name: /Good morning, Alex Morgan/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("separator", { name: "Collapse sidebar" }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  },
  "dashboard-report": async (page) => {
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByText("Revenue", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Customer metrics", { exact: true }),
    ).toBeVisible();
  },
  "data-grid": async (page) => {
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();
  },
  "filterable-collection": async (page) => {
    await expect(page.getByRole("button", { name: /filter/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Jordan Lee", exact: true }),
    ).toBeVisible();
  },
  "list-detail": async (page) => {
    await expect(
      page
        .getByRole("complementary", { name: "Contact details" })
        .getByText("Jordan Lee", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Activity/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hide contact details", exact: true }),
    ).toBeVisible();
  },
  "split-inbox": async (page) => {
    await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
    await expect(page.getByRole("row", { name: /Jordan Lee/ })).toBeVisible();
  },
  "record-aside": async (page) => {
    await expect(
      page
        .getByRole("complementary", { name: "Contact details" })
        .getByText("Jordan Lee", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hide contact details", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Details", { exact: true })).toBeVisible();
  },
  settings: async (page) => {
    await expect(page.getByRole("link", { name: "Back to app" })).toBeVisible();
    await expect(page.getByText("Account", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Billing" })).toBeVisible();
  },
  form: async (page) => {
    await expect(
      page.getByRole("heading", { name: "Form archetype" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Project name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save project" }),
    ).toBeVisible();
  },
  onboarding: async (page) => {
    await expect(
      page.getByRole("heading", { name: "Create a new workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Workspace name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create workspace" }),
    ).toBeVisible();
  },
  kanban: async (page) => {
    await expect(page.getByRole("heading", { name: "Contacts" })).toBeVisible();
    for (const column of ["Active", "Inactive"]) {
      await expect(page.getByText(column, { exact: true })).toBeVisible();
    }
    await expect(
      page.locator('[data-column="status:active"] [data-id="contact-1"]'),
    ).toContainText("Jordan Lee");
  },
  auth: async (page) => {
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Password", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  },
  billing: async (page) => {
    await expect(
      page.getByRole("heading", { name: "Billing", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Billing plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Invoices", { exact: true })).toBeVisible();
  },
  "search-command": async (page) => {
    await expect(
      page.getByRole("textbox", { name: /Search your workspace/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Recent searches", { exact: true }),
    ).toBeVisible();
  },
  states: async (page) => {
    await expect(
      page.getByRole("heading", { name: "State fixture" }),
    ).toBeVisible();
    await expect(
      page.getByText("Records are ready to review", { exact: true }),
    ).toBeVisible();
  },
};

function assertionFor(entry: AcceptanceEntry) {
  const assertion = compositionAssertions[entry.id];
  if (!assertion) throw new Error(`Missing rendered assertion for ${entry.id}`);
  return assertion;
}

function renderedRouteFor(entry: AcceptanceEntry) {
  // The starter's inbox route selects the first item and intentionally masks
  // the nested inbox URL as the selected contact route.
  return entry.id === "split-inbox"
    ? "/contacts/view/contact-1"
    : entry.id === "settings"
      ? "/settings/account"
      : concreteRoute(entry.route);
}

test.describe("paired acceptance-map compositions", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    void _page;
    testInfo.skip(
      testInfo.project.name !== "desktop-chromium",
      "Acceptance compositions are desktop-scoped; mobile reflow is covered separately.",
    );
  });

  for (const entry of acceptanceEntries) {
    test(`${entry.id} renders its mapped composition on both authorities`, async ({
      page,
    }) => {
      for (const kind of ["reference", "generated"] as const) {
        await gotoGolden({ page, kind, route: entry.route });
        await expect(page).toHaveURL(
          new RegExp(
            `${renderedRouteFor(entry).split("?")[0].replaceAll("/", "\\/")}(?:\\?|$)`,
          ),
        );
        await assertionFor(entry)(page, entry);
      }
    });
  }
});

const stateCases = [
  ["loading", "Loading workspace data"],
  ["empty", "No records yet"],
  ["ready-read", "Records are ready to review"],
  ["ready-edit", "Edit mode is enabled"],
  ["mutation-success", "Changes saved successfully"],
  ["mutation-failure", "Changes could not be saved"],
  ["error", "Something went wrong"],
  ["not-found", "The requested record was not found"],
  ["permission-denied", "You do not have permission to view this record"],
] as const;

test.describe("required state coverage", () => {
  for (const [fixture, copy] of stateCases) {
    test(`state fixture ${fixture} hydrates on both authorities`, async ({
      page,
    }) => {
      for (const kind of ["reference", "generated"] as const) {
        await gotoGolden({ page, kind, route: "/states", fixture });
        const status =
          fixture === "mutation-failure" || fixture === "error"
            ? page.getByRole("alert").filter({ hasText: copy })
            : fixture === "mutation-success"
              ? page.getByRole("status").filter({ hasText: copy })
              : page.getByText(copy, { exact: true });
        await expect(status).toBeVisible();
      }
    });
  }
});

test.describe("golden capture preconditions", () => {
  test("seeds dark mode and a consent decision before ready content", async ({
    page,
  }) => {
    for (const kind of ["reference", "generated"] as const) {
      await gotoGolden({
        page,
        kind,
        route: "/contacts/view/contact-1",
        colorMode: "dark",
      });

      await expect(
        page.getByRole("region", { name: "Cookie consent" }),
      ).toBeHidden();
      await expect(
        page
          .getByRole("complementary", { name: "Contact details" })
          .getByText("Jordan Lee", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("tab", { name: /Activity/i })).toBeVisible();
      await expect(
        page.locator('[data-scope="suiLoadingOverlay"]'),
      ).toHaveCount(0);

      await expect
        .poll(() =>
          page.evaluate(() => ({
            colorScheme: getComputedStyle(document.documentElement).colorScheme,
            themeClass: document.documentElement.className,
          })),
        )
        .toEqual({ colorScheme: "dark", themeClass: "dark" });
    }
  });
});
