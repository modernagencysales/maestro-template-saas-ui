import { useCallback, useEffect, useState, type ReactNode } from "react";

export type CookieConsentDecision = "accepted" | "declined";
export type CookieConsentState = CookieConsentDecision | "pending";

export const COOKIE_CONSENT_STORAGE_KEY = "maestro-template.cookie-consent";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const isCookieConsentDecision = (
  value: string | null,
): value is CookieConsentDecision =>
  value === "accepted" || value === "declined";

const browserStorage = (): StorageLike | null =>
  typeof window === "undefined" ? null : window.localStorage;

export const readCookieConsentDecision = (
  storage: StorageLike | null = browserStorage(),
): CookieConsentState => {
  if (!storage) {
    return "pending";
  }

  try {
    const stored = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return isCookieConsentDecision(stored) ? stored : "pending";
  } catch {
    return "pending";
  }
};

export const writeCookieConsentDecision = (
  decision: CookieConsentDecision,
  storage: StorageLike | null = browserStorage(),
): CookieConsentDecision => {
  if (!storage) {
    return decision;
  }

  try {
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, decision);
  } catch {
    // Consent still applies for the current render even if storage is blocked.
  }

  return decision;
};

export const shouldEnableAnalyticsCapture = (
  consent: CookieConsentState,
): boolean => consent === "accepted";

export const reconcileStoredCookieConsent = (
  current: CookieConsentState,
  stored: CookieConsentState,
): CookieConsentState => (current === "pending" ? stored : current);

export function CookieConsentBoundary({
  children,
}: {
  readonly children: (consent: CookieConsentState) => ReactNode;
}) {
  const [consent, setConsent] = useState<CookieConsentState>("pending");

  useEffect(() => {
    setConsent((current) =>
      reconcileStoredCookieConsent(current, readCookieConsentDecision()),
    );
  }, []);

  const chooseConsent = useCallback((decision: CookieConsentDecision) => {
    setConsent(writeCookieConsentDecision(decision));
  }, []);

  return (
    <>
      {children(consent)}
      <CookieConsentBanner consent={consent} onChoose={chooseConsent} />
    </>
  );
}

function CookieConsentBanner({
  consent,
  onChoose,
}: {
  readonly consent: CookieConsentState;
  readonly onChoose: (decision: CookieConsentDecision) => void;
}) {
  if (consent !== "pending") {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      className="template-cookie-banner"
      role="region"
    >
      <div>
        <strong>Analytics cookies</strong>
        <p>
          The template starts with analytics disabled until a user opts in.
          Client forks must replace this copy with their approved privacy
          language.
        </p>
      </div>
      <div className="template-cookie-banner-actions">
        <button onClick={() => onChoose("declined")} type="button">
          Decline
        </button>
        <button onClick={() => onChoose("accepted")} type="button">
          Accept analytics
        </button>
      </div>
    </section>
  );
}
