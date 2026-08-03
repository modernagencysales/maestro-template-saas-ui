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
  const productValid = Boolean(input.productId?.trim());
  const amountValid = Number.isSafeInteger(amount) && amount >= 0;
  const currencyValid = Boolean(currency && /^[A-Z]{3}$/.test(currency));
  return productValid && amountValid && currencyValid;
};

const supportedEventTypes = [
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
  "dispute.opened",
] as const;

const isSupportedEventType = (
  value: unknown,
): value is SupportedEvent["eventType"] =>
  typeof value === "string" &&
  supportedEventTypes.some((candidate) => candidate === value);

const optionalEventFields = (
  data: Record<string, unknown>,
): Omit<SupportedEvent, "eventType" | "paymentId"> => {
  return {
    ...checkoutFields(data),
    ...amountFields(data),
    ...attributionFields(data),
  };
};

const checkoutFields = (data: Record<string, unknown>) => {
  const checkoutSessionId = data.checkout_session_id;
  return {
    ...(typeof checkoutSessionId === "string" && checkoutSessionId.trim()
      ? { checkoutSessionId: checkoutSessionId.trim() }
      : {}),
    ...productFields(data),
  };
};

const productFields = (data: Record<string, unknown>) => {
  const productCart = Array.isArray(data.product_cart)
    ? objectRecord(data.product_cart[0])
    : null;
  return {
    ...(typeof data.product_id === "string"
      ? { productId: data.product_id.trim() }
      : typeof productCart?.product_id === "string"
        ? { productId: productCart.product_id.trim() }
        : {}),
  };
};

const amountFields = (data: Record<string, unknown>) => ({
  ...(typeof data.total_amount === "number"
    ? { amountCents: data.total_amount }
    : {}),
  ...(typeof data.currency === "string"
    ? { currency: data.currency.trim().toUpperCase() }
    : {}),
});

const attributionFields = (
  data: Record<string, unknown>,
): Pick<SupportedEvent, "admaxxerVisitorId" | "email"> => {
  const metadata = objectRecord(data.metadata);
  const customer = objectRecord(data.customer);
  return {
    ...(typeof metadata?.admx_visitor_id === "string"
      ? { admaxxerVisitorId: metadata.admx_visitor_id.trim() }
      : {}),
    ...(typeof customer?.email === "string"
      ? { email: customer.email.trim() }
      : {}),
  };
};

const parseJsonObject = (rawBody: string): Record<string, unknown> | null => {
  try {
    return objectRecord(JSON.parse(rawBody));
  } catch {
    return null;
  }
};

export const parseSupportedEvent = (rawBody: string): SupportedEvent | null => {
  const event = parseJsonObject(rawBody);
  const data = objectRecord(event?.data);
  const eventType = event?.type;
  const paymentId = data?.payment_id;
  if (!isSupportedEventType(eventType)) return null;
  if (typeof paymentId !== "string" || !paymentId.trim()) return null;
  if (data === null) return null;
  return {
    eventType,
    paymentId: paymentId.trim(),
    ...optionalEventFields(data),
  };
};
