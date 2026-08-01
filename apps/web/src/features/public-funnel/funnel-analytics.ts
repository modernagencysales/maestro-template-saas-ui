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
};
