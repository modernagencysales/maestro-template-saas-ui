import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { FunnelEvent } from "@maestro-template/app-idea-evaluator";

import { captureFunnelEvent } from "../features/public-funnel/funnel-analytics";
import type { CookieConsentState } from "./cookie-consent";

type AnalyticsSink = (
  name: string,
  properties: Record<string, unknown>,
) => void;

export type FunnelAnalyticsCapture = (event: FunnelEvent) => void;

const FunnelAnalyticsContext = createContext<FunnelAnalyticsCapture>(() => {});

export const useFunnelAnalytics = (): FunnelAnalyticsCapture =>
  useContext(FunnelAnalyticsContext);

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
