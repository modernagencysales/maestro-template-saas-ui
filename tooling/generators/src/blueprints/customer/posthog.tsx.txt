import type { ReactNode } from "react";
import {
  shouldEnableAnalyticsCapture,
  type CookieConsentState,
} from "./cookie-consent";

export const PostHogWebProvider = ({
  analyticsConsent = "pending",
  children,
}: {
  readonly analyticsConsent?: CookieConsentState;
  readonly children: ReactNode;
}) => {
  if (!shouldEnableAnalyticsCapture(analyticsConsent)) {
    return children;
  }

  return children;
};
