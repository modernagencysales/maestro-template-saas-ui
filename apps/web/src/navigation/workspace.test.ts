import { describe, expect, it } from "vitest";
import {
  activeTemplateRouteKey,
  TEMPLATE_NAV_CATEGORIES,
  TEMPLATE_ROUTE_ITEMS,
} from "./workspace";

describe("template workspace navigation", () => {
  it("exposes the generic AI/GTM app factory route registry", () => {
    expect(TEMPLATE_ROUTE_ITEMS.map((item) => item.key)).toEqual([
      "home",
      "brain",
      "workflows",
      "capabilities",
      "agents",
      "runs",
      "documents",
      "sources",
      "integrations",
      "api",
      "onboarding",
      "dataMap",
      "dataLifecycle",
      "notifications",
      "settings",
      "legal",
      "billing",
      "analytics",
      "health",
      "admin",
    ]);
  });

  it("resolves active route keys through longest-prefix matching", () => {
    expect(activeTemplateRouteKey("/")).toBeNull();
    expect(activeTemplateRouteKey("/dashboard")).toBe("home");
    expect(activeTemplateRouteKey("/workflows")).toBe("workflows");
    expect(activeTemplateRouteKey("/workflows/run_123")).toBe("workflows");
    expect(activeTemplateRouteKey("/data-map")).toBe("dataMap");
    expect(activeTemplateRouteKey("/data-lifecycle")).toBe("dataLifecycle");
    expect(activeTemplateRouteKey("/unknown")).toBeNull();
  });

  it("marks groups with active children as expandable by default", () => {
    const workflowGroup = TEMPLATE_NAV_CATEGORIES.find((category) =>
      category.items.some((item) => item.key === "workflows"),
    );

    expect(workflowGroup).toMatchObject({
      label: "Operate",
      defaultExpanded: true,
    });
  });
});
