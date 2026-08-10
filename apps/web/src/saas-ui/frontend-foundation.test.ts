import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

const patternFiles = [
  "activity-timeline",
  "add-contact-drawer",
  "analytics-chart",
  "billing-status",
  "collection-grid",
  "data-board",
  "data-filters",
  "file-card",
  "file-upload",
  "files-list-card",
  "form-section",
  "integration-card",
  "invite-people-dialog",
  "kpi-card",
  "latest-message-card",
  "manage-tags-dialog",
  "member-list",
  "notification-settings",
  "onboarding-steps",
  "page-states",
  "payment-overdue-banner",
  "pricing-table",
  "record-aside",
  "record-list-detail",
  "report",
  "roles-menu",
  "select-users-dialog",
  "sortable-task-list",
  "split-page",
  "stacked-navigation",
  "task-card",
] as const;

describe("checked-in Saas UI frontend foundation", () => {
  it("keeps the provider, appearance, font, and CLI configuration", () => {
    const components = JSON.parse(read("apps/web/components.json"));
    expect(components).toMatchObject({
      system: "chakra",
      rsc: false,
      tsx: true,
    });
    expect(components.aliases).toMatchObject({
      components: "@/components",
      ui: "@/components/ui",
    });
    expect(read("apps/web/src/saas-ui/provider.tsx")).toContain("SuiProvider");
    expect(read("apps/web/src/saas-ui/system.ts")).toContain(
      "createSystem(defaultConfig, templateConfig)",
    );
    expect(read("apps/web/src/saas-ui/color-mode.tsx")).toContain(
      "AppearancePreference",
    );
    expect(read("apps/web/src/routes/__root.tsx")).toContain(
      'import "@fontsource-variable/inter"',
    );
  });

  it("keeps one workspace shell and every selected layout", () => {
    expect(read("apps/web/src/routes/_workspace.tsx")).toContain(
      "BusinessAppShell",
    );
    for (const layout of [
      "public",
      "auth",
      "fullscreen",
      "error",
      "settings",
    ]) {
      expect(
        existsSync(
          resolve(
            repoRoot,
            `apps/web/src/saas-ui/layouts/${layout}-layout.tsx`,
          ),
        ),
      ).toBe(true);
    }
  });

  it("keeps the complete live and ready-source pattern shelf", () => {
    const barrel = read("apps/web/src/saas-ui/patterns/index.ts");
    for (const pattern of patternFiles) {
      expect(
        existsSync(
          resolve(repoRoot, `apps/web/src/saas-ui/patterns/${pattern}.tsx`),
        ),
      ).toBe(true);
      expect(barrel).toContain(`export * from "./${pattern}"`);
    }
  });

  it("starts with truthful empty state and neutral assets", () => {
    const shell = read("apps/web/src/saas-ui/business-shell.tsx");
    expect(shell).toContain("TruthfulEmptyState");
    for (const fabricated of [
      "$428K",
      "Northstar Labs",
      "37 active",
      "Acme Demo",
    ]) {
      expect(shell).not.toContain(fabricated);
    }
    expect(read("apps/web/public/favicon.svg")).toContain(
      'fill="currentColor"',
    );
    expect(read("apps/web/public/social-card.svg")).toContain(
      'fill="currentColor"',
    );
    expect(read("apps/web/public/manifest.webmanifest")).not.toContain(
      "theme_color",
    );
  });

  it("keeps required direct runtimes and excludes rejected starter stacks", () => {
    const packageJson = JSON.parse(read("apps/web/package.json"));
    expect(packageJson.dependencies).toMatchObject({
      "@fontsource-variable/inter": "5.2.8",
      "@saas-ui-pro/react": "1.0.0-next.4",
      "@saas-ui/react": "3.0.0-next.51",
      "next-themes": "0.4.6",
    });
    for (const rejected of [
      "@tanstack/react-query-devtools",
      "@tanstack/react-router-devtools",
      "@trpc/client",
      "better-auth",
      "drizzle-orm",
      "stripe",
    ]) {
      expect(packageJson.dependencies[rejected]).toBeUndefined();
    }
  });

  it("does not restore superseded examples or sample records", () => {
    for (const path of [
      "apps/web/src/saas-ui/status-notice.tsx",
      "apps/web/src/sample/templateData.ts",
      "packages/ui/src/blocks/template-dialog.tsx",
      "packages/ui/src/settings/template-settings-panel.tsx",
      "packages/ui/src/shell/template-workspace-shell.tsx",
      "packages/ui/src/visualize/data-grid.tsx",
      "packages/ui/src/visualize/kanban-board.tsx",
    ]) {
      expect(existsSync(resolve(repoRoot, path))).toBe(false);
    }
  });
});
