import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  CookieConsentBoundary,
  reconcileStoredCookieConsent,
  readCookieConsentDecision,
  shouldEnableAnalyticsCapture,
  writeCookieConsentDecision,
  type CookieConsentDecision,
} from "./cookie-consent";

const memoryStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial) {
    values.set(COOKIE_CONSENT_STORAGE_KEY, initial);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("cookie consent", () => {
  it("reads only valid stored consent decisions", () => {
    expect(readCookieConsentDecision(null)).toBe("pending");
    expect(readCookieConsentDecision(memoryStorage("accepted"))).toBe(
      "accepted",
    );
    expect(readCookieConsentDecision(memoryStorage("declined"))).toBe(
      "declined",
    );
    expect(readCookieConsentDecision(memoryStorage("maybe"))).toBe("pending");
  });

  it("writes accepted or declined decisions without requiring browser storage", () => {
    const storage = memoryStorage();

    expect(writeCookieConsentDecision("accepted", storage)).toBe("accepted");
    expect(readCookieConsentDecision(storage)).toBe("accepted");
    expect(writeCookieConsentDecision("declined", null)).toBe("declined");
  });

  it("enables analytics capture only after explicit acceptance", () => {
    expect(shouldEnableAnalyticsCapture("pending")).toBe(false);
    expect(shouldEnableAnalyticsCapture("declined")).toBe(false);
    expect(shouldEnableAnalyticsCapture("accepted")).toBe(true);
  });

  it("does not overwrite a fast explicit choice during storage hydration", () => {
    expect(reconcileStoredCookieConsent("declined", "pending")).toBe(
      "declined",
    );
    expect(reconcileStoredCookieConsent("pending", "accepted")).toBe(
      "accepted",
    );
  });

  it("renders a fake-safe consent banner while pending", () => {
    const html = renderToStaticMarkup(
      <CookieConsentBoundary>
        {(consent) => <main>{consent}</main>}
      </CookieConsentBoundary>,
    );

    expect(html).toContain("Cookie consent");
    expect(html).toContain("Analytics cookies");
    expect(html).toContain("Decline");
    expect(html).toContain("Accept analytics");
    expect(html).toContain("pending");
  });

  it("keeps decision type narrow for future provider gates", () => {
    const decisions = [
      writeCookieConsentDecision("accepted", null),
      writeCookieConsentDecision("declined", null),
    ] satisfies readonly CookieConsentDecision[];

    expect(decisions).toEqual(["accepted", "declined"]);
  });
});
