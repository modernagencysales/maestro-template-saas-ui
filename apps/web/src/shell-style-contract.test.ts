import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string =>
  readFileSync(resolve(appRoot, path), "utf8");

describe("Saas UI shell style contract", () => {
  it("installs Saas UI as the visible app shell provider", () => {
    const root = read("src/routes/__root.tsx");
    const provider = read("src/saas-ui/provider.tsx");

    expect(root).toContain("MaestroSaasUiProvider");
    expect(provider).toContain("SuiProvider");
    expect(provider).toContain("defaultSystem");
  });

  it("loads only the app and workflow styles from the root route head", () => {
    const root = read("src/routes/__root.tsx");

    expect(root).not.toContain("../notion.css?url");
    expect(root).toContain("../index.css?url");
    expect(root).toContain("@xyflow/react/dist/style.css?url");
  });

  it("uses the Saas UI business shell instead of the old reference app route", () => {
    const index = read("src/routes/index.tsx");
    const shell = read("src/saas-ui/business-shell.tsx");

    expect(index).toContain("BusinessDashboardRoute");
    expect(index).not.toContain("TemplateReferenceApp");
    expect(shell).toContain("@saas-ui/react");
    expect(shell).toContain("BusinessAppShell");
    expect(shell).toContain("BusinessSectionRoute");
    expect(shell).toContain("BusinessPageRoot");
    expect(shell).toContain('id="template-main-content"');
    expect(shell).toContain("LiveWorkflowRunsPanel");
  });

  it("owns global route UX wiring at the root route", () => {
    const root = read("src/routes/__root.tsx");
    const boundary = read("src/navigation/route-ux-boundary.tsx");
    const network = read("src/navigation/network-state.ts");

    expect(root).toContain("WebRouteUxBoundary");
    expect(root).toContain("TemplateToastProvider");
    expect(root).toContain("CookieConsentBoundary");
    expect(root).toContain("analyticsConsent={analyticsConsent}");
    expect(root).toContain("useRouterState");
    expect(root).toContain("<Outlet />");
    expect(boundary).toContain("TemplateRouteFocusBoundary");
    expect(boundary).toContain("describeRouteAnnouncement");
    expect(boundary).toContain("useBrowserNetworkState");
    expect(boundary).toContain("networkState={networkState}");
    expect(boundary).toContain("retryCurrentRoute");
    expect(boundary).toContain("window.location.reload");
    expect(boundary).toContain("Retry now");
    expect(boundary).toContain("hashchange");
    expect(network).toContain('"online"');
    expect(network).toContain('"offline"');
  });

  it("uses reusable route pending and error surfaces", () => {
    const router = read("src/router.tsx");

    expect(router).toContain("TemplateRoutePending");
    expect(router).toContain("TemplateRouteError");
    expect(router).toContain("Return to overview");
    expect(router).not.toContain("defaultPendingComponent: () => null");
    expect(router).not.toContain("<main>Not Found</main>");
  });

  it("keeps workspace route links inside the Saas UI business shell", () => {
    const shell = read("src/saas-ui/business-shell.tsx");

    expect(shell).toContain("TEMPLATE_NAV_CATEGORIES");
    expect(shell).toContain('aria-label="Primary"');
    expect(shell).toContain("template-sidebar-row");
  });

  it("surfaces a visible Confect query and mutation slice", () => {
    const shell = read("src/saas-ui/business-shell.tsx");
    const route = read("src/routes/_workspace.data-lifecycle.tsx");
    const surface = read(
      "src/features/data-lifecycle/data-lifecycle-surface.tsx",
    );
    const liveRuns = read("src/features/workflows/live-runs-panel.tsx");

    expect(shell).toContain("BusinessDataLifecycleRoute");
    expect(route).toContain("BusinessDataLifecycleRoute");
    expect(surface).toContain("useTemplateMutation");
    expect(surface).toContain("useTemplateQuery");
    expect(surface).toContain("@saas-ui/react");
    expect(liveRuns).toContain("useTemplateQuery");
    expect(liveRuns).toContain(
      "templateConfectRefs.public.demo.showcase.overview",
    );
  });

  it("defines UX safety classes and reduced-motion behavior", () => {
    const css = read("src/index.css");

    expect(css).toContain(".template-skip-link");
    expect(css).toContain(".template-live-region");
    expect(css).toContain(".template-shell-content");
    expect(css).toContain(".template-network-banner");
    expect(css).toContain(".template-network-banner-action");
    expect(css).toContain(".template-cookie-banner");
    expect(css).toContain(".template-cookie-banner-actions");
    expect(css).toContain(".template-empty-state");
    expect(css).toContain(".template-form-panel");
    expect(css).toContain(".template-form-actions");
    expect(css).toContain(".template-dialog-backdrop");
    expect(css).toContain(".template-dialog");
    expect(css).toContain(".template-toast-region");
    expect(css).toContain(".template-route-state");
    expect(css).toContain(".template-route-state-actions");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".workflow-canvas .react-flow__edge.animated path");
  });
});
