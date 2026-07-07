import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string =>
  readFileSync(resolve(appRoot, path), "utf8");

describe("TanStack Start runtime contract", () => {
  it("wires the router through Convex React Query and generated routeTree", () => {
    const source = read("src/router.tsx");

    expect(source).toContain('import "./react-global"');
    expect(source).toContain('from "@convex-dev/react-query"');
    expect(source).toContain('from "@tanstack/react-query"');
    expect(source).toContain('from "@tanstack/react-router"');
    expect(source).toContain('from "@tanstack/react-router-ssr-query"');
    expect(source).toContain('from "./routeTree.gen"');
    expect(source).toContain("new ConvexQueryClient");
    expect(source).toContain("new QueryClient");
    expect(source).toContain("setupRouterSsrQueryIntegration");
    expect(source).toContain('defaultPreload: "intent"');
    expect(source).toContain("scrollRestoration: true");
  });

  it("installs React for the TanStack Start generated client entry", () => {
    const source = read("src/react-global.ts");

    expect(source).toContain('import * as React from "react"');
    expect(source).toContain("reactGlobal.React ??= React");
  });

  it("keeps the root route as a provider boundary", () => {
    const source = read("src/routes/__root.tsx");

    expect(source).toContain("createRootRouteWithContext");
    expect(source).toContain("AuthKitProvider");
    expect(source).toContain("ConvexProviderWithAuth");
    expect(source).toContain("PostHogWebProvider");
    expect(source).toContain("WorkspaceProvider");
    expect(source).toContain("HeadContent");
    expect(source).toContain("Outlet");
    expect(source).toContain("Scripts");
  });

  it("keeps the Saas UI business dashboard as a Start route", () => {
    const source = read("src/routes/index.tsx");

    expect(source).toContain('createFileRoute("/")');
    expect(source).toContain("BusinessDashboardRoute");
    expect(source).not.toContain("TemplateReferenceApp");
  });

  it("keeps route loaders out of feature view-model shaping", () => {
    const root = read("src/routes/__root.tsx");
    const index = read("src/routes/index.tsx");

    expect(root).not.toContain("loader:");
    expect(root).not.toContain("beforeLoad:");
    expect(index).not.toContain("loader:");
    expect(index).not.toContain("beforeLoad:");
  });
});
