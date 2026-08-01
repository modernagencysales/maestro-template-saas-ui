import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PostHogWebProvider, useFunnelAnalytics } from "./posthog";

const checkoutStarted = {
  name: "checkout_started" as const,
  reportId: "report_1",
};

describe("consent-aware funnel analytics provider", () => {
  it.each(["pending", "declined"] as const)(
    "does not capture with %s consent",
    (analyticsConsent) => {
      const sink = vi.fn();
      let capture: ReturnType<typeof useFunnelAnalytics> | undefined;
      const Probe = () => {
        capture = useFunnelAnalytics();
        return null;
      };

      renderToStaticMarkup(
        <PostHogWebProvider analyticsConsent={analyticsConsent} capture={sink}>
          <Probe />
        </PostHogWebProvider>,
      );
      capture?.(checkoutStarted);

      expect(sink).not.toHaveBeenCalled();
    },
  );

  it("captures a validated event after consent without its name in properties", () => {
    const sink = vi.fn();
    let capture: ReturnType<typeof useFunnelAnalytics> | undefined;
    const Probe = () => {
      capture = useFunnelAnalytics();
      return null;
    };

    renderToStaticMarkup(
      <PostHogWebProvider analyticsConsent="accepted" capture={sink}>
        <Probe />
      </PostHogWebProvider>,
    );
    capture?.(checkoutStarted);

    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith("checkout_started", {
      reportId: "report_1",
    });
  });
});
