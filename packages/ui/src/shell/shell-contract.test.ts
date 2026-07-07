import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("local reusable shell contract", () => {
  it("uses local shell markup without Notion Kit imports", () => {
    const shell = read("src/shell/template-workspace-shell.tsx");

    expect(shell).not.toContain("@notion-kit");
    expect(shell).toContain("template-workspace-shell");
    expect(shell).toContain("template-sidebar");
    expect(shell).toContain("template-shell-topbar");
    expect(shell).toContain("useState");
  });

  it("keeps route and action sidebar rows as typed adapters", () => {
    const shell = read("src/shell/template-workspace-shell.tsx");

    expect(shell).toContain("TemplateRouteItem");
    expect(shell).toContain("TemplateActionItem");
    expect(shell).toContain("TemplateFooterItem");
    expect(shell).toContain("template-sidebar-menuitem");
  });

  it("wires active route state, expandable groups, and collapsed controls", () => {
    const shell = read("src/shell/template-workspace-shell.tsx");

    expect(shell).toContain("TemplateMainContent");
    expect(shell).toContain('className="template-shell-content"');
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain("activeKey === item.key");
    expect(shell).toContain("data-default-expanded");
    expect(shell).toContain("category.defaultExpanded");
    expect(shell).toContain('aria-label="Close sidebar"');
    expect(shell).toContain('aria-label="Open sidebar"');
    expect(shell).toContain("setSidebarOpen");
  });

  it("closes the local sidebar after route navigation", () => {
    const shell = read("src/shell/template-workspace-shell.tsx");

    expect(shell).toContain("onClose?.()");
    expect(shell).toContain("const closeSidebar = () => setSidebarOpen(false)");
    expect(shell).toContain("onClose={closeSidebar}");
  });
});
