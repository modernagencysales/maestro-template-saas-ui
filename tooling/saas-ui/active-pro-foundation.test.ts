import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("active Saas UI Pro application foundation", () => {
  it("uses the exact Pro shell shape without the Starter inset rim", () => {
    const appLayout = read(
      "apps/web/src/features/common/layouts/app-layout.tsx",
    );
    const sidebarLayout = read(
      "apps/web/src/features/common/layouts/sidebar-layout.tsx",
    );

    expect(appLayout).toContain('<AppShell h="$100vh"');
    expect(appLayout).not.toContain("Sidebar.Inset");
    expect(appLayout).not.toContain('variant="inset"');
    expect(sidebarLayout).toContain("<Sidebar.Provider>");
    expect(sidebarLayout).toContain("<Sidebar.FlyoutTrigger />");
    expect(sidebarLayout).toContain("<Sidebar.Backdrop />");
  });

  it("mounts the complete Pro primary navigation", () => {
    const sidebar = read(
      "apps/web/src/features/common/components/app-sidebar.tsx",
    );

    for (const label of [
      "Updates",
      "People",
      "Companies",
      "Workflows",
      "Reports",
    ]) {
      expect(sidebar).toContain(`label="${label}"`);
    }
    expect(sidebar).not.toContain('label="Showcase"');
  });

  it("provides thin TanStack routes for the first Pro screen slice", () => {
    const routes = [
      "apps/web/src/routes/_app/$workspace/_dashboard/updates.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/updates/$id.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/reports.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/companies.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/workflows.tsx",
    ];

    for (const route of routes)
      expect(existsSync(resolve(root, route))).toBe(true);
  });
});
