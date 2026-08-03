export type SupportedEvent = {
  readonly eventType:
    | "payment.succeeded"
    | "payment.failed"
    | "refund.succeeded"
    | "dispute.opened";
  readonly paymentId: string;
  readonly checkoutSessionId?: string;
  readonly productId?: string;
  readonly amountCents?: number;
  readonly currency?: string;
  readonly admaxxerVisitorId?: string;
  readonly email?: string;
};

const objectRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const validateLiveDodoBindings = (input: {
  readonly productId?: string;
  readonly amountCents?: string;
  readonly currency?: string;
}): boolean => {
  const amount = Number(input.amountCents);
  const currency = input.currency?.trim().toUpperCase();
  return Boolean(
    input.productId?.trim() &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    currency &&
    /^[A-Z]{3}$/.test(currency),
  );
};

export const parseSupportedEvent = (rawBody: string): SupportedEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const event = objectRecord(parsed);
  const data = objectRecord(event?.data);
  const eventType = event?.type;
  const paymentId = data?.payment_id;
  if (
    (eventType !== "payment.succeeded" &&
      eventType !== "payment.failed" &&
      eventType !== "refund.succeeded" &&
      eventType !== "dispute.opened") ||
    typeof paymentId !== "string" ||
    !paymentId.trim()
  )
    return null;
  const checkoutSessionId = data?.checkout_session_id;
  const productCart = Array.isArray(data?.product_cart)
    ? objectRecord(data.product_cart[0])
    : null;
  const metadata = objectRecord(data?.metadata);
  const customer = objectRecord(data?.customer);
  return {
    eventType,
    paymentId: paymentId.trim(),
    ...(typeof checkoutSessionId === "string" && checkoutSessionId.trim()
      ? { checkoutSessionId: checkoutSessionId.trim() }
      : {}),
    ...(typeof data?.product_id === "string"
      ? { productId: data.product_id.trim() }
      : typeof productCart?.product_id === "string"
        ? { productId: productCart.product_id.trim() }
        : {}),
    ...(typeof data?.total_amount === "number"
      ? { amountCents: data.total_amount }
      : {}),
    ...(typeof data?.currency === "string"
      ? { currency: data.currency.trim().toUpperCase() }
      : {}),
    ...(typeof metadata?.admx_visitor_id === "string"
      ? { admaxxerVisitorId: metadata.admx_visitor_id.trim() }
      : {}),
    ...(typeof customer?.email === "string"
      ? { email: customer.email.trim() }
      : {}),
  };
};
