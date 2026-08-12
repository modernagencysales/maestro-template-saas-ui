import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  activeTemplateRouteKey,
  TEMPLATE_ROUTE_ITEMS,
} from "./navigation/workspace";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string =>
  readFileSync(resolve(appRoot, path), "utf8");

describe("frontend platform routes", () => {
  it("keeps advertised routes backed by the upstream chassis", () => {
    for (const item of TEMPLATE_ROUTE_ITEMS) {
      const route =
        item.path === "/"
          ? "src/routes/index.tsx"
          : item.path === "/onboarding" || item.path === "/settings"
            ? `src/routes/_workspace.${item.path.slice(1).replaceAll("/", ".")}.tsx`
            : `src/routes/_workspace._dashboard.${item.path.slice(1).replaceAll("/", ".")}.tsx`;
      expect(
        existsSync(resolve(appRoot, route)),
        `${item.path} should exist`,
      ).toBe(true);
    }
    const workspaceRoute = read("src/routes/_workspace.tsx");
    const dashboardLayout = read(
      "src/features/common/layouts/dashboard-layout.tsx",
    );
    const appLayout = read("src/features/common/layouts/app-layout.tsx");
    expect(workspaceRoute).not.toContain("AppLayout");
    expect(workspaceRoute).not.toContain("DashboardLayout");
    expect(read("src/routes/_workspace._dashboard.tsx")).toContain(
      "<DashboardLayout",
    );
    expect(read("src/routes/_workspace.settings.tsx")).toContain(
      "<SettingsLayout",
    );
    expect(dashboardLayout.match(/<AppLayout\s+sidebar=/g)).toHaveLength(1);
    expect(appLayout.match(/<SaasSidebarProvider\s+variant=/g)).toHaveLength(1);
    expect(existsSync(resolve(appRoot, "src/saas-ui/business-shell.tsx"))).toBe(
      false,
    );
    expect(activeTemplateRouteKey("/notifications")).toBe("notifications");
  });

  it("ships the pinned archetype routes", () => {
    for (const route of [
      "contacts",
      "inbox",
      "reports",
      "forms",
      "kanban",
      "states",
    ]) {
      expect(
        existsSync(
          resolve(appRoot, `src/routes/_workspace._dashboard.${route}.tsx`),
        ),
      ).toBe(true);
    }
    expect(read("src/routes/dashboard.tsx")).toContain("DashboardPage");
  });

  it("ships starter-safe public assets", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as Record<
      string,
      unknown
    >;
    expect(manifest).toMatchObject({
      name: "Maestro Template",
      short_name: "Maestro",
      display: "standalone",
      start_url: "/",
    });
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain("offline");
    expect(read("src/routes/__root.tsx")).toContain("buildTemplateRouteHead");
  });
});
