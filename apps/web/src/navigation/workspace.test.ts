import { describe, expect, it } from "vitest";
import {
  activeTemplateRouteKey,
  GLOBAL_WORKSPACE_ACTIONS,
  PRODUCT_ROUTE_ITEMS,
  REFERENCE_ROUTE_ITEMS,
  TEMPLATE_NAV_CATEGORIES,
  TEMPLATE_ROUTE_ITEMS,
} from "./workspace";

const hiddenReferencePaths = [
  "/workflows",
  "/capabilities",
  "/agents",
  "/runs",
  "/documents",
  "/sources",
  "/integrations",
  "/api",
  "/onboarding",
  "/data-map",
  "/data-lifecycle",
  "/notifications",
  "/legal",
  "/billing",
  "/analytics",
  "/health",
  "/admin",
];

describe("Maestro Brain workspace navigation", () => {
  it("exposes only the V1 product shell routes and global Ask/Search action", () => {
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.key)).toEqual([
      "clients",
      "brain",
      "connections",
      "settings",
    ]);
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.label)).toEqual([
      "Clients",
      "Agency Brain",
      "Connections",
      "Settings",
    ]);
    expect(GLOBAL_WORKSPACE_ACTIONS).toEqual([
      expect.objectContaining({ key: "askSearch", label: "Ask / Search" }),
    ]);
  });

  it("keeps hidden reference URLs out of the product navigation manifest", () => {
    const visibleManifest = JSON.stringify(TEMPLATE_NAV_CATEGORIES);

    for (const hiddenPath of hiddenReferencePaths) {
      expect(visibleManifest).not.toContain(hiddenPath);
    }
    expect(PRODUCT_ROUTE_ITEMS).toEqual(TEMPLATE_ROUTE_ITEMS);
    expect(REFERENCE_ROUTE_ITEMS.map((item) => item.path)).toEqual(
      hiddenReferencePaths,
    );
  });

  it("resolves active product route keys through longest-prefix matching", () => {
    expect(activeTemplateRouteKey("/")).toBeNull();
    expect(activeTemplateRouteKey("/clients")).toBe("clients");
    expect(activeTemplateRouteKey("/clients/acme")).toBe("clients");
    expect(activeTemplateRouteKey("/brain/pages/overview")).toBe("brain");
    expect(activeTemplateRouteKey("/connections/slack")).toBe("connections");
    expect(activeTemplateRouteKey("/settings/members")).toBe("settings");
    expect(activeTemplateRouteKey("/workflows")).toBeNull();
    expect(activeTemplateRouteKey("/unknown")).toBeNull();
  });

  it("keeps the mobile navigation keyboard reachable", () => {
    expect(TEMPLATE_NAV_CATEGORIES).toEqual([
      {
        label: "Workspace",
        defaultExpanded: true,
        items: TEMPLATE_ROUTE_ITEMS,
      },
    ]);
  });
});
