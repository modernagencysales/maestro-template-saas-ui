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
const routeFileForPath = (path: string): string =>
  path === "/"
    ? "src/routes/index.tsx"
    : `src/routes/_workspace.${path.slice(1).replaceAll("/", ".")}.tsx`;

describe("frontend platform routes", () => {
  it("registers legal, onboarding, data lifecycle, and notification workspace routes in navigation", () => {
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.key)).toContain("legal");
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.key)).toContain(
      "dataLifecycle",
    );
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.key)).toContain(
      "notifications",
    );
    expect(TEMPLATE_ROUTE_ITEMS.find((item) => item.key === "legal")).toEqual(
      expect.objectContaining({
        label: "Legal",
        path: "/legal",
      }),
    );
    expect(activeTemplateRouteKey("/legal/privacy")).toBe("legal");
    expect(activeTemplateRouteKey("/onboarding")).toBe("onboarding");
    expect(activeTemplateRouteKey("/data-lifecycle")).toBe("dataLifecycle");
    expect(activeTemplateRouteKey("/notifications")).toBe("notifications");
  });

  it("defines legal, onboarding, data lifecycle, and notification route files as starter-ready surfaces", () => {
    expect(
      existsSync(resolve(appRoot, "src/routes/_workspace.legal.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(appRoot, "src/routes/_workspace.onboarding.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(appRoot, "src/routes/_workspace.notifications.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(appRoot, "src/routes/_workspace.data-lifecycle.tsx")),
    ).toBe(true);
    expect(read("src/routes/_workspace.legal.tsx")).toContain(
      'section="legal"',
    );
    expect(read("src/routes/_workspace.legal.tsx")).not.toContain(
      "ReferenceDocumentRoute",
    );
    expect(read("src/routes/_workspace.onboarding.tsx")).toContain(
      'section="onboarding"',
    );
    expect(read("src/routes/_workspace.notifications.tsx")).toContain(
      'section="notifications"',
    );
    expect(read("src/routes/_workspace.data-lifecycle.tsx")).toContain(
      "BusinessDataLifecycleRoute",
    );
    expect(read("src/saas-ui/business-shell.tsx")).toContain(
      "BusinessSectionRoute",
    );
  });

  it("has a route file for every advertised workspace navigation path", () => {
    for (const item of TEMPLATE_ROUTE_ITEMS) {
      expect(
        existsSync(resolve(appRoot, routeFileForPath(item.path))),
        `${item.path} should be backed by ${routeFileForPath(item.path)}`,
      ).toBe(true);
    }
    expect(read("src/routes/index.tsx")).toContain("BusinessDashboardRoute");
    expect(read("src/routes/_workspace.health.tsx")).toContain(
      'section="health"',
    );
    expect(read("src/routes/_workspace.data-lifecycle.tsx")).toContain(
      "BusinessDataLifecycleRoute",
    );
    expect(read("src/saas-ui/business-shell.tsx")).toContain("@saas-ui/react");
    expect(read("src/saas-ui/business-shell.tsx")).not.toContain(
      "ReferenceDocumentRoute",
    );
  });

  it("ships a PWA manifest without unsupported offline claims", () => {
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
    expect(manifest.icons).toEqual([
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ]);
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain("offline");
  });

  it("ships starter-safe public SEO assets", () => {
    expect(read("public/robots.txt")).toContain(
      "Sitemap: https://maestro-template.pages.dev/sitemap.xml",
    );
    expect(read("public/sitemap.xml")).toContain(
      "https://maestro-template.pages.dev/onboarding",
    );
    expect(read("public/favicon.svg")).toContain("Maestro Template");
    expect(read("public/social-card.svg")).toContain("Maestro Template");
    expect(read("src/routes/__root.tsx")).toContain("buildTemplateRouteHead");
  });
});
