import {
  validateFunnelEvent,
  type FunnelEvent,
} from "@maestro-template/app-idea-evaluator";
import {
  shouldEnableAnalyticsCapture,
  type CookieConsentState,
} from "../../providers/cookie-consent";

export const captureFunnelEvent = (
  consent: CookieConsentState,
  eventInput: unknown,
  capture: (name: string, properties: Record<string, unknown>) => void,
): void => {
  const event = validateFunnelEvent(eventInput);
  if (!shouldEnableAnalyticsCapture(consent)) return;
  const { name, ...properties } = event as FunnelEvent;
  capture(name, properties);
  if (event.name === "evaluation_completed") {
    const client = (
      globalThis as typeof globalThis & {
        admaxxer?: (
          eventName: string,
          eventProperties?: Record<string, unknown>,
        ) => void;
      }
    ).admaxxer;
    const key = `app-idea:lead:${event.evaluationId}`;
    let seen = false;
    try {
      seen = globalThis.sessionStorage?.getItem(key) === "1";
    } catch {
      // Storage is optional; consent and provider validation still apply.
    }
    if (client && !seen) {
      client("Lead", {
        offer_slug: "app-idea-evaluator",
        evaluation_id: event.evaluationId,
      });
      try {
        globalThis.sessionStorage?.setItem(key, "1");
      } catch {
        // Ignore unavailable browser storage.
      }
    }
  }
};
