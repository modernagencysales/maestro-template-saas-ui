import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(webRoot, "../..");
const readWeb = (path: string) => readFileSync(resolve(webRoot, path), "utf8");

describe("pinned Saas UI frontend fidelity", () => {
  it("keeps the starter shell split into editable application components", () => {
    for (const path of [
      "src/saas-ui/layouts/app-layout.tsx",
      "src/saas-ui/layouts/dashboard-layout.tsx",
      "src/saas-ui/components/app-sidebar.tsx",
      "src/saas-ui/components/global-search-input.tsx",
      "src/saas-ui/components/user-menu.tsx",
      "src/saas-ui/components/workspaces-menu.tsx",
    ]) {
      expect(existsSync(resolve(webRoot, path)), path).toBe(true);
    }

    const shell = readWeb("src/saas-ui/business-shell.tsx");
    expect(shell).toContain("DashboardLayout");
    expect(shell).not.toContain("Template user");
  });

  it("keeps appearance and search in the application chrome", () => {
    expect(readWeb("src/saas-ui/components/user-menu.tsx")).toContain(
      "AppearanceMenu",
    );
    const search = readWeb("src/saas-ui/components/global-search-input.tsx");
    expect(search).toContain("SearchInput");
    expect(search).toContain('aria-keyshortcuts="/"');
  });

  it("uses the starter application shell for settings and fullscreen layouts", () => {
    expect(readWeb("src/saas-ui/layouts/settings-layout.tsx")).toContain(
      "AppLayout",
    );
    expect(readWeb("src/saas-ui/layouts/fullscreen-layout.tsx")).toContain(
      "AppShell",
    );
  });

  it("uses authoritative keyboard-capable board and sortable primitives", () => {
    const board = readWeb("src/saas-ui/patterns/data-board.tsx");
    expect(board).toContain('from "@saas-ui-pro/kanban"');
    expect(board).toContain("KanbanDragOverlay");

    const sortable = readWeb("src/saas-ui/patterns/sortable-task-list.tsx");
    expect(sortable).toContain("KeyboardSensor");
    expect(sortable).toContain("sortableKeyboardCoordinates");
    expect(sortable).toContain("DndContext");
  });

  it("uses the official chart and file-upload component systems", () => {
    expect(readWeb("src/saas-ui/patterns/analytics-chart.tsx")).toContain(
      'from "@chakra-ui/charts"',
    );
    const upload = readWeb("src/saas-ui/patterns/file-upload.tsx");
    expect(upload).toContain("FileUpload.Root");
    expect(upload).toContain("FileUpload.Trigger");
  });

  it("declares only the direct runtimes imported by checked-in source", () => {
    const dependencies = JSON.parse(readWeb("package.json")).dependencies;
    expect(dependencies).toMatchObject({
      "@chakra-ui/charts": expect.any(String),
      "@dnd-kit/core": expect.any(String),
      "@dnd-kit/sortable": expect.any(String),
      "@saas-ui-pro/kanban": expect.any(String),
      recharts: expect.any(String),
    });

    expect(
      readFileSync(resolve(repoRoot, "apps/web/components.json"), "utf8"),
    ).toContain("sidebar1");
  });
});
