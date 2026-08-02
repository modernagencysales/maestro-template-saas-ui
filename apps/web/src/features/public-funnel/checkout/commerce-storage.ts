import {
  applyPaymentEvent,
  checkoutReturn,
  createCommerceState,
  type CommerceState,
} from "@maestro-template/app-idea-evaluator";

const commerceKey = "maestro.idea-funnel.commerce";

const load = (): CommerceState => {
  if (typeof window === "undefined") return createCommerceState();
  try {
    const value = window.localStorage.getItem(commerceKey);
    return value ? (JSON.parse(value) as CommerceState) : createCommerceState();
  } catch {
    return createCommerceState();
  }
};

const save = (state: CommerceState): CommerceState => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(commerceKey, JSON.stringify(state));
  }
  return state;
};

const safePart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9_-]/g, "-");

export type FakeCheckoutSession = {
  readonly checkoutSessionId: string;
  readonly reportId: string;
  readonly amountCents: number;
  readonly returnUrl: string;
  readonly hostedCheckoutUrl: string;
};

export const beginFakeCheckout = (
  reportId: string,
  amountCents: number,
): FakeCheckoutSession => {
  const checkoutSessionId = `checkout_${safePart(reportId)}_${String(Date.now())}`;
  save(
    checkoutReturn(load(), {
      checkoutSessionId,
      reportId,
    }),
  );
  const returnUrl = `/checkout/return?session_id=${encodeURIComponent(checkoutSessionId)}&report_id=${encodeURIComponent(reportId)}`;
  return {
    checkoutSessionId,
    reportId,
    amountCents,
    returnUrl,
    hostedCheckoutUrl: `/checkout/fake-hosted/${encodeURIComponent(checkoutSessionId)}?report_id=${encodeURIComponent(reportId)}&amount_cents=${String(amountCents)}&return_url=${encodeURIComponent(returnUrl)}`,
  };
};

/**
 * Deterministic local-provider harness. It models delivery through the same
 * verified-event state transition as a Dodo webhook; the return page never
 * calls this function and therefore cannot grant access.
 */
export const deliverFakeVerifiedPaymentWebhook = (
  session: FakeCheckoutSession,
): CommerceState =>
  save(
    applyPaymentEvent(load(), {
      eventId: `evt_${session.checkoutSessionId}`,
      type: "payment.succeeded",
      paymentId: `pay_${session.checkoutSessionId}`,
      checkoutSessionId: session.checkoutSessionId,
      reportId: session.reportId,
      amountCents: session.amountCents,
      currency: "USD",
      signatureVerified: true,
    }),
  );

export const entitlementStatusFor = (
  reportId: string,
): "active" | "revoked" | "missing" =>
  load().entitlements.find((item) => item.reportId === reportId)?.status ??
  "missing";

export const maestroCreditFor = (reportId: string): number =>
  load().maestroCredits.find((item) => item.reportId === reportId)
    ?.amountCents ?? 0;
