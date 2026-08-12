// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuiProvider } from "@saas-ui/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";

import { AppLayout } from "./layouts/app-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { GoldenAdapterProvider } from "../golden/adapters";
import { goldenFixtures } from "../golden/fixtures";
import { system } from "../../theme/preset";

vi.mock("./components/global-search-input", () => ({
  GlobalSearchInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("./components/app-sidebar", () => ({
  AppSidebar: () => (
    <aside>
      <button type="button" aria-label="Workspace: Acme Inc.">
        Acme Inc.
      </button>
      <button type="button" aria-label="User menu">
        Alex Morgan
      </button>
    </aside>
  ),
}));

describe("transplanted application shell", () => {
  it("preserves upstream shell controls while adapters supply neutral data", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const workspaceRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/$workspace",
      component: () => (
        <GoldenAdapterProvider>
          <SuiProvider value={system}>
            <DashboardLayout>Body</DashboardLayout>
          </SuiProvider>
        </GoldenAdapterProvider>
      ),
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([workspaceRoute]),
      history: createMemoryHistory({ initialEntries: ["/acme"] }),
    });
    await router.load();

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /workspace/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /user menu/i })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: /search/i })).toBeTruthy();
    expect(screen.getByText(goldenFixtures.currentWorkspace.name)).toBeTruthy();
  });
});
