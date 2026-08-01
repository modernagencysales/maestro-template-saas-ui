export type CommerceState = {
  readonly checkoutReturns: readonly CheckoutReturn[];
  readonly entitlements: readonly BuildPackEntitlement[];
  readonly maestroCredits: readonly MaestroCredit[];
  readonly processedEventIds: readonly string[];
};

export type CheckoutReturn = {
  readonly checkoutSessionId: string;
  readonly reportId: string;
  readonly status: "payment-pending" | "paid";
};

export type BuildPackEntitlement = {
  readonly reportId: string;
  readonly paymentId: string;
  readonly status: "active" | "revoked";
};

export type MaestroCredit = {
  readonly reportId: string;
  readonly paymentId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: "available" | "applied" | "revoked";
};

export type PaymentEvent = {
  readonly eventId: string;
  readonly type:
    | "payment.succeeded"
    | "payment.failed"
    | "refund.succeeded"
    | "dispute.opened";
  readonly paymentId: string;
  readonly checkoutSessionId?: string;
  readonly reportId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly signatureVerified: boolean;
};

export const createCommerceState = (): CommerceState => ({
  checkoutReturns: [],
  entitlements: [],
  maestroCredits: [],
  processedEventIds: [],
});

export const checkoutReturn = (
  state: CommerceState,
  returned: Omit<CheckoutReturn, "status">,
): CommerceState => ({
  ...state,
  checkoutReturns: [
    ...state.checkoutReturns.filter(
      ({ checkoutSessionId }) =>
        checkoutSessionId !== returned.checkoutSessionId,
    ),
    { ...returned, status: "payment-pending" },
  ],
});

export const applyPaymentEvent = (
  state: CommerceState,
  event: PaymentEvent,
): CommerceState => {
  if (!event.signatureVerified) {
    throw new Error("Entitlement requires a verified webhook.");
  }
  if (state.processedEventIds.includes(event.eventId)) return state;

  const processedEventIds = [...state.processedEventIds, event.eventId];
  if (event.type === "payment.failed") {
    return { ...state, processedEventIds };
  }
  if (event.type === "refund.succeeded" || event.type === "dispute.opened") {
    return {
      ...state,
      processedEventIds,
      entitlements: state.entitlements.map((entitlement) =>
        entitlement.paymentId === event.paymentId
          ? { ...entitlement, status: "revoked" as const }
          : entitlement,
      ),
      maestroCredits: state.maestroCredits.map((credit) =>
        credit.paymentId === event.paymentId
          ? { ...credit, status: "revoked" as const }
          : credit,
      ),
    };
  }

  const entitlementExists = state.entitlements.some(
    ({ reportId }) => reportId === event.reportId,
  );
  const creditExists = state.maestroCredits.some(
    ({ reportId }) => reportId === event.reportId,
  );
  return {
    ...state,
    processedEventIds,
    checkoutReturns: state.checkoutReturns.map((returned) =>
      returned.checkoutSessionId === event.checkoutSessionId
        ? { ...returned, status: "paid" as const }
        : returned,
    ),
    entitlements: entitlementExists
      ? state.entitlements
      : [
          ...state.entitlements,
          {
            reportId: event.reportId,
            paymentId: event.paymentId,
            status: "active",
          },
        ],
    maestroCredits: creditExists
      ? state.maestroCredits
      : [
          ...state.maestroCredits,
          {
            reportId: event.reportId,
            paymentId: event.paymentId,
            amountCents: event.amountCents,
            currency: event.currency,
            status: "available",
          },
        ],
  };
};
