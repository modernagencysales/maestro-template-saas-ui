import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TemplateMainContent,
  TemplateRouteError,
  TemplateRouteFocusBoundary,
  TemplateRoutePending,
  TemplateToastProvider,
  useTemplateToast,
} from "./ux-essentials";

function ToastTrigger() {
  const toast = useTemplateToast();

  return (
    <button
      type="button"
      onClick={() =>
        toast.notify({
          title: "Saved",
          description: "Workspace settings were updated.",
          tone: "success",
          autoDismissMs: 0,
        })
      }
    >
      Save
    </button>
  );
}

function ToastOutsideProvider() {
  const toast = useTemplateToast();
  const toastId = toast.notify({
    title: "Saved",
    autoDismissMs: 0,
  });
  const politeAnnouncementId = toast.announce("Saved");
  const assertiveAnnouncementId = toast.announceAssertive("Save failed");

  return (
    <span>
      {toastId}:{politeAnnouncementId}:{assertiveAnnouncementId}
    </span>
  );
}

describe("TemplateToastProvider", () => {
  it("renders an initial toast with title, detail, and tone", () => {
    const html = renderToStaticMarkup(
      <TemplateToastProvider
        initialToasts={[
          {
            id: "toast_saved",
            title: "Saved",
            description: "Workspace settings were updated.",
            tone: "success",
          },
        ]}
      >
        <ToastTrigger />
      </TemplateToastProvider>,
    );

    expect(html).toContain("template-toast-region");
    expect(html).toContain("template-toast success");
    expect(html).toContain("Saved");
    expect(html).toContain("Workspace settings were updated.");
    expect(html).toContain('aria-live="polite"');
  });

  it("renders polite and assertive screen-reader announcement regions", () => {
    const html = renderToStaticMarkup(
      <TemplateToastProvider>
        <ToastTrigger />
      </TemplateToastProvider>,
    );

    expect(html).toContain("template-announcement-region");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('role="alert"');
  });

  it("marks dangerous toasts as alerts for destructive failures", () => {
    const html = renderToStaticMarkup(
      <TemplateToastProvider
        initialToasts={[
          {
            id: "toast_delete_failed",
            title: "Delete failed",
            description: "The workspace was not removed.",
            tone: "danger",
          },
        ]}
      >
        <ToastTrigger />
      </TemplateToastProvider>,
    );

    expect(html).toContain("template-toast danger");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Delete failed");
    expect(html).toContain("The workspace was not removed.");
  });

  it("exports a hook for mutation handlers to emit toasts", () => {
    const html = renderToStaticMarkup(
      <TemplateToastProvider>
        <ToastTrigger />
      </TemplateToastProvider>,
    );

    expect(html).toContain("Save");
    expect(useTemplateToast).toBeTypeOf("function");
  });

  it("returns a safe fallback API when the hook is used outside a provider", () => {
    const html = renderToStaticMarkup(<ToastOutsideProvider />);

    expect(html).toContain("template-toast-missing-provider");
    expect(html).toContain("template-announcement-missing-provider");
  });
});

describe("template route UX helpers", () => {
  it("renders route pending and error states with useful copy and actions", () => {
    const pending = renderToStaticMarkup(
      <TemplateRoutePending
        label="Loading workspace"
        description="Fetching route data."
      />,
    );
    const error = renderToStaticMarkup(
      <TemplateRouteError
        title="Page not found"
        description="This route is not part of the workspace."
        action={<a href="/">Return to overview</a>}
      />,
    );

    expect(pending).toContain('role="status"');
    expect(pending).toContain("Please wait");
    expect(pending).toContain("Loading workspace");
    expect(pending).toContain("Fetching route data.");
    expect(error).toContain('role="alert"');
    expect(error).toContain("Route unavailable");
    expect(error).toContain("Page not found");
    expect(error).toContain("Return to overview");
    expect(error).toContain("template-route-state-actions");
  });

  it("renders skip-link, polite announcement, and online children", () => {
    const html = renderToStaticMarkup(
      <TemplateRouteFocusBoundary announcement="Viewing Overview" focusKey="/">
        <TemplateMainContent>
          <h1>Overview</h1>
        </TemplateMainContent>
      </TemplateRouteFocusBoundary>,
    );

    expect(html).toContain('href="#template-main-content"');
    expect(html).toContain("Viewing Overview");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="template-main-content"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("Overview");
    expect(html).not.toContain("template-network-banner");
  });

  it("can announce degraded network state without changing the main target", () => {
    const html = renderToStaticMarkup(
      <TemplateRouteFocusBoundary
        announcement="Viewing Legal"
        focusKey="/_workspace/legal"
        networkAction={<button type="button">Retry now</button>}
        networkState="degraded"
      >
        <TemplateMainContent className="template-page">
          Legal
        </TemplateMainContent>
      </TemplateRouteFocusBoundary>,
    );

    expect(html).toContain("Network is degraded");
    expect(html).toContain("Retry now");
    expect(html).toContain("template-network-banner-action");
    expect(html).toContain('class="template-page"');
    expect(html).toContain('id="template-main-content"');
  });
});
