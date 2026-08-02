import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { FunnelEvent } from "@maestro-template/app-idea-evaluator";

import { captureFunnelEvent } from "../features/public-funnel/funnel-analytics";
import type { CookieConsentState } from "./cookie-consent";

type AnalyticsSink = (
  name: string,
  properties: Record<string, unknown>,
) => void;

export type FunnelAnalyticsCapture = (event: FunnelEvent) => void;
export type FunnelEventTransition = readonly [key: string, event: FunnelEvent];

export const captureUnseenFunnelEvents = (
  seen: Set<string>,
  transitions: readonly FunnelEventTransition[],
  capture: FunnelAnalyticsCapture,
): void => {
  for (const [key, event] of transitions) {
    if (seen.has(key)) continue;
    seen.add(key);
    capture(event);
  }
};

const FunnelAnalyticsContext = createContext<FunnelAnalyticsCapture>(() => {});

export const useFunnelAnalytics = (): FunnelAnalyticsCapture =>
  useContext(FunnelAnalyticsContext);

export const useFunnelEventsOnce = (
  transitions: readonly FunnelEventTransition[],
): void => {
  const capture = useFunnelAnalytics();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    captureUnseenFunnelEvents(seen.current, transitions, capture);
  }, [capture, transitions]);
};

export const PostHogWebProvider = ({
  analyticsConsent = "pending",
  capture = () => {},
  children,
}: {
  readonly analyticsConsent?: CookieConsentState;
  readonly capture?: AnalyticsSink;
  readonly children: ReactNode;
}) => {
  const captureValidatedEvent = useMemo<FunnelAnalyticsCapture>(
    () => (event) => captureFunnelEvent(analyticsConsent, event, capture),
    [analyticsConsent, capture],
  );

  return (
    <FunnelAnalyticsContext.Provider value={captureValidatedEvent}>
      {children}
    </FunnelAnalyticsContext.Provider>
  );
};
