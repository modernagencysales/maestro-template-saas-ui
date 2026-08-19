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

  it("installs the Pro theme recipes used by the demo components", () => {
    const preset = read("apps/web/src/theme/preset.ts");

    expect(preset).toContain(
      "import { defaultConfig } from '@saas-ui-pro/react'",
    );
    expect(preset).not.toContain(
      "import { defaultConfig } from '@saas-ui/chakra-preset'",
    );
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
      "UI Lab",
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

  it("assembles the selected Pro Storybook demos as live UI Lab routes", () => {
    const page = read("apps/web/src/features/ui-lab/ui-lab-page.tsx");
    const writer = read("apps/web/src/features/ui-lab/writer-demo.tsx");
    const kanban = read("apps/web/src/features/ui-lab/kanban-demo.tsx");

    for (const id of [
      "writer",
      "kanban",
      "data-grid",
      "filters",
      "split-page",
      "sidebar-1",
      "sidebar-2",
      "sidebar-3",
      "sidebar-4",
      "navbar-branded",
      "navbar-tabs",
    ])
      expect(page).toContain(`id: '${id}'`);

    expect(writer).toContain("export function WriterDemo()");
    expect(writer).toContain("<Reorder.Group");
    expect(kanban).toContain("export function KanbanDemo()");
    expect(kanban).toContain("backlog: createRange(20");
    expect(page).toContain("const dataGridColumnSizeProps = (size: number)");
    expect(page).toContain(
      "...dataGridColumnSizeProps(header.column.getSize())",
    );
    expect(page).toContain(
      "css: dataGridColumnSizeProps(cell.column.getSize())",
    );
    expect(
      existsSync(resolve(root, "apps/web/src/routes/ui-lab/$demo.tsx")),
    ).toBe(true);
  });

  it("exposes the complete Pro settings and onboarding screen set", () => {
    for (const route of [
      "apps/web/src/routes/_app/$workspace/settings/index.tsx",
      "apps/web/src/routes/_app/$workspace/settings/account/api.tsx",
      "apps/web/src/routes/_app/$workspace/settings/account/notifications.tsx",
      "apps/web/src/routes/_app/$workspace/settings/account/profile.tsx",
      "apps/web/src/routes/_app/$workspace/settings/account/security.tsx",
      "apps/web/src/routes/_app/$workspace/settings/members.tsx",
      "apps/web/src/routes/_app/$workspace/settings/billing.tsx",
      "apps/web/src/routes/_app/$workspace/settings/plans.tsx",
      "apps/web/src/routes/_app/getting-started/index.tsx",
    ])
      expect(existsSync(resolve(root, route))).toBe(true);

    expect(
      read("apps/web/src/features/getting-started/getting-started-page.tsx"),
    ).toContain('<Container maxW="6xl">');
  });
});
