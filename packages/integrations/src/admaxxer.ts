/** Minimal server-side Admaxxer Payments API boundary. */
export type AdmaxxerPaymentInput = {
  readonly paymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly visitorId?: string | undefined;
  readonly email?: string | undefined;
};

export type AdmaxxerPaymentTransport = (
  input: AdmaxxerPaymentInput & { readonly apiKey: string },
) => Promise<void>;

const endpoint = "https://admaxxer.com/api/v1/payments";

const clean = (value: string | undefined, max: number): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length <= max ? normalized : undefined;
};

const fractionDigits = (currency: string): number => {
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    throw new Error("The payment currency is invalid.");
  }
};

const optionalPaymentFields = (
  input: AdmaxxerPaymentInput,
): Record<string, string> => {
  const visitorId = clean(input.visitorId, 180);
  const email = clean(input.email, 320)?.toLowerCase();
  return {
    ...(visitorId ? { admaxxer_visitor_id: visitorId } : {}),
    ...(email ? { email } : {}),
  };
};

const paymentBody = (
  input: AdmaxxerPaymentInput,
): Record<string, string | number> => {
  const paymentId = clean(input.paymentId, 180);
  const currency = clean(input.currency, 3)?.toUpperCase();
  if (!paymentId) throw new Error("The payment ID is missing.");
  if (!currency || currency.length !== 3)
    throw new Error("The payment currency is missing.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0)
    throw new Error("The payment amount is invalid.");
  return {
    amount: input.amountMinor / 10 ** fractionDigits(currency),
    currency,
    transaction_id: paymentId,
    ...optionalPaymentFields(input),
  };
};

export const recordAdmaxxerPayment = async (
  input: AdmaxxerPaymentInput,
  options: {
    readonly apiKey?: string;
    readonly fetcher?: typeof fetch;
    readonly transport?: AdmaxxerPaymentTransport;
  } = {},
): Promise<boolean> => {
  const apiKey = clean(options.apiKey, 512);
  if (!apiKey) return false;
  const body = paymentBody(input);
  if (options.transport) {
    await options.transport({ ...input, apiKey });
    return true;
  }
  const response = await (options.fetcher ?? fetch)(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      `Admaxxer payment attribution failed (${response.status}).`,
    );
  return true;
};
