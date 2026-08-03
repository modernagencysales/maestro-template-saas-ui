import {
  validateFunnelEvent,
  type FunnelEvent,
} from "@maestro-template/app-idea-evaluator";
import {
  shouldEnableAnalyticsCapture,
  type CookieConsentState,
} from "../../providers/cookie-consent";

type AdmaxxerClient = (
  eventName: string,
  eventProperties?: Record<string, unknown>,
) => void;

const wasLeadCaptured = (key: string): boolean => {
  try {
    return globalThis.sessionStorage?.getItem(key) === "1";
  } catch {
    return false;
  }
};

const rememberLead = (key: string): void => {
  try {
    globalThis.sessionStorage?.setItem(key, "1");
  } catch {
    // Storage is optional; consent and provider validation still apply.
  }
};

const captureAdmaxxerLead = (event: FunnelEvent): void => {
  if (event.name !== "evaluation_completed") return;
  const client = (
    globalThis as typeof globalThis & { admaxxer?: AdmaxxerClient }
  ).admaxxer;
  const key = `app-idea:lead:${event.evaluationId}`;
  if (!client || wasLeadCaptured(key)) return;
  client("Lead", {
    offer_slug: "app-idea-evaluator",
    evaluation_id: event.evaluationId,
  });
  rememberLead(key);
};

export const captureFunnelEvent = (
  consent: CookieConsentState,
  eventInput: unknown,
  capture: (name: string, properties: Record<string, unknown>) => void,
): void => {
  const event = validateFunnelEvent(eventInput);
  if (!shouldEnableAnalyticsCapture(consent)) return;
  const { name, ...properties } = event as FunnelEvent;
  capture(name, properties);
  captureAdmaxxerLead(event);
};
