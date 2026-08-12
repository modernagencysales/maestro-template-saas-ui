// @vitest-environment node

import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SuiProvider } from "@saas-ui/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { GoldenAdapterProvider } from "#features/golden/adapters";
import { system } from "#theme/preset";

vi.mock("#lib/user-settings/use-user-settings", () => ({
  useUserSettings: () => [
    {
      contactsView: "list",
      contactsColumns: ["name", "email", "createdAt", "type", "status"],
      contactsGroupBy: "status",
    },
  ],
}));

vi.mock("@saas-ui-pro/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@saas-ui-pro/react")>();
  return {
    ...actual,
    DataGrid: () => {
      throw new Error("DataGrid evaluated during SSR");
    },
  };
});

import { ContactsListPage } from "./list-page";

describe("ContactsListPage", () => {
  it("renders the data-grid route during SSR without browser globals", async () => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const contactsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/contacts",
      component: () => (
        <GoldenAdapterProvider>
          <SuiProvider value={system}>
            <ContactsListPage params={{ workspace: "acme" }} />
          </SuiProvider>
        </GoldenAdapterProvider>
      ),
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([contactsRoute]),
      history: createMemoryHistory({ initialEntries: ["/contacts"] }),
    });
    await router.load();

    let markup = "";
    expect(() => {
      markup = renderToString(<RouterProvider router={router} />);
    }).not.toThrow();
    expect(markup).toContain("Contacts");
  });

  it("defers the browser-only DataGrid behind ClientOnly", () => {
    const root = process.cwd().endsWith("/apps/web")
      ? process.cwd()
      : resolve(process.cwd(), "apps/web");
    const source = readFileSync(
      resolve(root, "src/features/contacts/list/list-page.tsx"),
      "utf8",
    );

    expect(source).toContain("<ClientOnly fallback={null}>");
  });
});
