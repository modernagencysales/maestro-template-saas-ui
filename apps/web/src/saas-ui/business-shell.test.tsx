import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { BusinessAppShell, BusinessPageRoot } from "./business-shell";
import { ColorModeProvider } from "./color-mode";
import { AuthLayout } from "./layouts/auth-layout";
import { ErrorLayout } from "./layouts/error-layout";
import { FullscreenLayout } from "./layouts/fullscreen-layout";
import { PublicLayout } from "./layouts/public-layout";
import { SettingsLayout } from "./layouts/settings-layout";
import { MaestroSaasUiProvider } from "./provider";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const webSourceRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const renderWithProviders = (children: ReactNode) =>
  renderToStaticMarkup(
    <ColorModeProvider>
      <MaestroSaasUiProvider>{children}</MaestroSaasUiProvider>
    </ColorModeProvider>,
  );

const jsxIdentifierCount = (path: string, identifier: string): number => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let count = 0;

  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === identifier
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return count;
};

describe("business application shell", () => {
  it("renders the accessible responsive workspace boundary", () => {
    const html = renderWithProviders(
      <BusinessAppShell networkState="offline" pathname="/dashboard">
        <BusinessPageRoot>
          <h1>Overview</h1>
        </BusinessPageRoot>
      </BusinessAppShell>,
    );

    expect(html).toContain('href="#workspace-main"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Viewing Overview");
    expect(html).toContain("You are offline");
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain("Maestro workspace");
    expect(html).toContain("Template user");
    expect(html).toContain('id="workspace-main"');
    expect(html).toContain('tabindex="-1"');
  });

  it("ships distinct public, auth, fullscreen, settings, and error layouts", () => {
    const layouts = [
      renderWithProviders(<PublicLayout>Public</PublicLayout>),
      renderWithProviders(<AuthLayout title="Sign in">Auth</AuthLayout>),
      renderWithProviders(<FullscreenLayout>Fullscreen</FullscreenLayout>),
      renderWithProviders(
        <SettingsLayout title="Settings">Settings</SettingsLayout>,
      ),
      renderWithProviders(
        <ErrorLayout title="Not found">Missing route</ErrorLayout>,
      ),
    ];

    expect(new Set(layouts).size).toBe(layouts.length);
    for (const html of layouts) expect(html).toContain("<main");
  });

  it("has one route-owned shell and no fabricated dashboard records", () => {
    const routesRoot = `${webSourceRoot}/routes`;
    const routeFiles = readdirSync(routesRoot)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => `${routesRoot}/${file}`);
    const shellOwners = routeFiles.reduce(
      (count, path) => count + jsxIdentifierCount(path, "BusinessAppShell"),
      0,
    );
    const shellSource = readFileSync(
      `${webSourceRoot}/saas-ui/business-shell.tsx`,
      "utf8",
    );

    expect(shellOwners).toBe(1);
    for (const fabricated of ["$428K", "Northstar Labs", "37 active"]) {
      expect(shellSource).not.toContain(fabricated);
    }
  });

  it("removes the replaced package shell and settings entry points", () => {
    const packageIndex = `${repositoryRoot}/packages/ui/src/index.tsx`;
    const packageJson = JSON.parse(
      readFileSync(`${repositoryRoot}/packages/ui/package.json`, "utf8"),
    ) as { exports: Record<string, unknown> };

    expect(jsxIdentifierCount(packageIndex, "TemplateWorkspaceShell")).toBe(0);
    expect(readFileSync(packageIndex, "utf8")).not.toContain(
      "template-workspace-shell",
    );
    expect(packageJson.exports).not.toHaveProperty("./settings");
  });
});
