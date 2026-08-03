import * as Effect from "effect/Effect";
import {
  BillingIdempotencyKeyError,
  validateBillingIdempotencyKey,
} from "./billing";
import {
  ProviderCallError,
  ProviderConfigError,
  defaultProviderOperation,
  providerDescriptors,
  redactProviderPayload,
  validateProviderConfig,
  type ProviderAdapter,
  type ProviderAdapterInput,
  type ProviderAdapterReceipt,
  type ProviderId,
  type ProviderMode,
} from "./providerRegistry";

const deliveryFor = (
  mode: ProviderMode,
): ProviderAdapterReceipt["delivery"] => {
  if (mode === "fake") return "fake";
  return mode === "test" ? "test" : "live-ready";
};

const validateWorkspaceSlug = (workspaceSlug: string) =>
  /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(workspaceSlug)
    ? true
    : new ProviderCallError({
        provider: "workspace",
        publicMessage: "workspaceSlug must be a lowercase slug.",
        retryable: false,
      });

const validateBillingCall = (
  id: ProviderId,
  operation: string,
  idempotencyKey: string | undefined,
): ProviderCallError | undefined => {
  if (operation !== "billing.createCheckout") return undefined;
  const result = validateBillingIdempotencyKey(idempotencyKey);
  return result instanceof BillingIdempotencyKeyError
    ? new ProviderCallError({
        provider: id,
        publicMessage:
          idempotencyKey === undefined
            ? "idempotencyKey is required for billing checkout operations."
            : result.message,
        retryable: false,
      })
    : undefined;
};

const providerCall = (
  id: ProviderId,
  mode: ProviderMode,
  input: ProviderAdapterInput,
) =>
  Effect.gen(function* () {
    const workspace = validateWorkspaceSlug(input.workspaceSlug);
    const failure =
      workspace === true
        ? validateBillingCall(id, input.operation, input.idempotencyKey)
        : workspace;
    if (failure) return yield* Effect.fail(failure);
    return {
      provider: id,
      mode,
      operation: input.operation,
      delivery: deliveryFor(mode),
      receiptId: `${id}_${mode}_${input.operation.replaceAll(".", "_")}_001`,
      redactedPayload: redactProviderPayload(id, input.payload),
    };
  });

export const createProviderAdapter = (
  id: ProviderId,
  mode: ProviderMode,
  env: Record<string, string | undefined> = {},
): ProviderConfigError | ProviderAdapter => {
  const config = validateProviderConfig(id, mode, env);
  if (config !== true) return config;
  return {
    provider: id,
    mode,
    call: (input) => providerCall(id, mode, input),
  };
};

export const buildProviderAdapters = (
  mode: ProviderMode,
  env: Record<string, string | undefined> = {},
) =>
  providerDescriptors.map(({ id }) => ({
    id,
    adapter: createProviderAdapter(id, mode, env),
  }));

export const smokeProviderAdapter = async (
  id: ProviderId,
  mode: ProviderMode,
  env: Record<string, string | undefined> = {},
): Promise<
  ProviderAdapterReceipt | ProviderConfigError | ProviderCallError
> => {
  const adapter = createProviderAdapter(id, mode, env);
  if (adapter instanceof ProviderConfigError) return adapter;
  return Effect.runPromise(
    Effect.match(
      adapter.call({
        operation: defaultProviderOperation(id),
        workspaceSlug: "acme-demo",
        idempotencyKey: `${id}-smoke-001`,
        payload: {
          apiKey: "secret",
          recipient: "client@example.test",
          prompt: "source text",
          customerEmail: "client@example.test",
          event: "template.provider.smoke",
        },
      }),
      {
        onFailure: (error) => error,
        onSuccess: (receipt) => receipt,
      },
    ),
  );
};
