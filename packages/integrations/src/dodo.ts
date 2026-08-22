import DodoPayments from "dodopayments";
import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";

export class DodoWebhookConfigError extends Schema.TaggedErrorClass<DodoWebhookConfigError>()(
  "DodoWebhookConfigError",
  {
    missing: Schema.Array(Schema.String),
  },
) {}

export class DodoCheckoutProviderError extends Schema.TaggedErrorClass<DodoCheckoutProviderError>()(
  "DodoCheckoutProviderError",
  {
    operation: Schema.String,
    status: Schema.optional(Schema.Number),
    retryable: Schema.Boolean,
  },
) {}

export class DodoWebhookReplayError extends Schema.TaggedErrorClass<DodoWebhookReplayError>()(
  "DodoWebhookReplayError",
  {
    eventId: Schema.String,
  },
) {}

export class DodoWebhookSignatureError extends Schema.TaggedErrorClass<DodoWebhookSignatureError>()(
  "DodoWebhookSignatureError",
  {
    reason: Schema.String,
  },
) {}

export class DodoWebhookEventIdError extends Schema.TaggedErrorClass<DodoWebhookEventIdError>()(
  "DodoWebhookEventIdError",
  { field: Schema.String },
) {}

export class DodoWebhookPayloadError extends Schema.TaggedErrorClass<DodoWebhookPayloadError>()(
  "DodoWebhookPayloadError",
  { reason: Schema.String },
) {}

export type DodoWebhookVerification =
  | {
      readonly ok: true;
      readonly mode: ProviderMode;
      readonly eventId: string;
    }
  | DodoWebhookConfigError
  | DodoWebhookEventIdError
  | DodoWebhookPayloadError
  | DodoWebhookReplayError
  | DodoWebhookSignatureError;

export type DodoCheckoutResult = {
  readonly provider: "dodo";
  readonly mode: ProviderMode;
  readonly checkoutSessionId: string;
  readonly checkoutUrl: string;
  readonly reportId: string;
};

export type DodoCheckoutTransportRequest = {
  readonly apiKey: string;
  readonly productCart: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
  readonly customer: { readonly email: string };
  readonly metadata: Readonly<Record<string, string>>;
  readonly returnUrl: string;
  readonly idempotencyKey: string;
};

export type DodoCheckoutTransport = (
  request: DodoCheckoutTransportRequest,
) => Promise<{
  readonly checkoutSessionId: string;
  readonly checkoutUrl: string;
}>;

export const normalizeAdmaxxerVisitorId = (
  value: string | undefined,
): string | undefined => {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9._~-]{1,180}$/.test(normalized)
    ? normalized
    : undefined;
};

export type DodoSdkEnvironment = "live_mode" | "test_mode";

type DodoSdkCheckoutInput = {
  readonly product_cart: readonly {
    readonly product_id: string;
    readonly quantity: number;
  }[];
  readonly customer: { readonly email: string };
  readonly metadata: Readonly<Record<string, string>>;
  readonly return_url: string;
};

type DodoSdkCheckoutClient = {
  readonly checkoutSessions: {
    readonly create: (
      input: DodoSdkCheckoutInput,
      options?: { readonly idempotencyKey?: string },
    ) => Promise<{
      readonly session_id: string;
      readonly checkout_url?: string | null;
    }>;
  };
};

type DodoSdkClientFactory = (options: {
  readonly bearerToken: string;
  readonly environment: DodoSdkEnvironment;
}) => DodoSdkCheckoutClient;

const defaultDodoSdkClientFactory: DodoSdkClientFactory = (options) => {
  const client = new DodoPayments(options);
  return {
    checkoutSessions: {
      create: async (input, requestOptions) =>
        await client.checkoutSessions.create(
          {
            product_cart: input.product_cart.map((item) => ({ ...item })),
            customer: input.customer,
            metadata: { ...input.metadata },
            return_url: input.return_url,
          },
          requestOptions,
        ),
    },
  };
};

export const createDodoSdkCheckoutTransport = (options: {
  readonly environment: DodoSdkEnvironment;
  readonly clientFactory?: DodoSdkClientFactory;
}): DodoCheckoutTransport => {
  const clientFactory = options.clientFactory ?? defaultDodoSdkClientFactory;

  return async (request) => {
    const client = clientFactory({
      bearerToken: request.apiKey,
      environment: options.environment,
    });
    const session = await client.checkoutSessions.create(
      {
        product_cart: request.productCart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        customer: request.customer,
        metadata: request.metadata,
        return_url: request.returnUrl,
      },
      { idempotencyKey: request.idempotencyKey },
    );
    if (!session.checkout_url) {
      throw Object.assign(new Error("Dodo did not return a checkout URL."), {
        status: 502,
      });
    }
    return {
      checkoutSessionId: session.session_id,
      checkoutUrl: session.checkout_url,
    };
  };
};

const providerStatus = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? typeof error.status === "number"
      ? error.status
      : undefined
    : undefined;

const checkoutPart = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);

type DodoCheckoutInput = {
  readonly mode: ProviderMode;
  readonly apiKey: string | undefined;
  readonly productId: string;
  readonly reportId: string;
  readonly customerEmail: string;
  readonly admaxxerVisitorId?: string | undefined;
  readonly returnUrl: string;
  readonly idempotencyKey: string;
  readonly transport?: DodoCheckoutTransport;
};

type DodoCheckoutOutcome =
  DodoCheckoutResult | DodoWebhookConfigError | DodoCheckoutProviderError;

const createFakeCheckout = (input: DodoCheckoutInput): DodoCheckoutResult => {
  const checkoutSessionId = `checkout_${checkoutPart(input.idempotencyKey)}`;
  const checkoutUrl = new URL(input.returnUrl);
  checkoutUrl.searchParams.set("session_id", checkoutSessionId);
  return {
    provider: "dodo",
    mode: input.mode,
    checkoutSessionId,
    checkoutUrl: checkoutUrl.toString(),
    reportId: input.reportId,
  };
};

const apiKeyConfigError = (
  input: DodoCheckoutInput,
): DodoWebhookConfigError | undefined => {
  if (input.mode === "live" && !input.apiKey?.trim())
    return new DodoWebhookConfigError({ missing: ["DODO_API_KEY"] });
  return undefined;
};

const checkoutProviderError = (error: unknown): DodoCheckoutProviderError => {
  const status = providerStatus(error);
  return new DodoCheckoutProviderError({
    operation: "checkout.create",
    ...(status === undefined ? {} : { status }),
    retryable: status === undefined || status === 429 || status >= 500,
  });
};

const createHostedCheckout = async (
  input: DodoCheckoutInput,
): Promise<
  DodoCheckoutResult | DodoWebhookConfigError | DodoCheckoutProviderError
> => {
  const configError = apiKeyConfigError(input);
  if (configError) return configError;
  const transport = input.transport;
  if (!transport)
    return new DodoWebhookConfigError({ missing: ["DODO_CHECKOUT_TRANSPORT"] });
  try {
    const visitorId = normalizeAdmaxxerVisitorId(input.admaxxerVisitorId);
    const hosted = await transport({
      apiKey: input.apiKey ?? "",
      productCart: [{ productId: input.productId, quantity: 1 }],
      customer: { email: input.customerEmail },
      metadata: {
        reportId: input.reportId,
        ...(visitorId ? { admx_visitor_id: visitorId } : {}),
      },
      returnUrl: input.returnUrl,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      provider: "dodo",
      mode: input.mode,
      ...hosted,
      reportId: input.reportId,
    };
  } catch (error) {
    return checkoutProviderError(error);
  }
};

export const createDodoCheckout = (
  input: DodoCheckoutInput,
): Promise<DodoCheckoutOutcome> =>
  input.mode === "fake"
    ? Promise.resolve(createFakeCheckout(input))
    : createHostedCheckout(input);

export {
  normalizeDodoWebhook,
  verifyDodoWebhook,
  type NormalizedDodoWebhook,
} from "./dodoWebhook";
