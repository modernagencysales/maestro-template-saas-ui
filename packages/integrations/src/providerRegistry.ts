import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";

export type ProviderMode = "fake" | "test" | "live";

export type ProviderId =
  | "workos"
  | "posthog"
  | "dodo"
  | "email"
  | "openrouter"
  | "storage"
  | "search"
  | "flags";

export type ProviderFamily =
  | "auth"
  | "analytics"
  | "billing"
  | "email"
  | "llm"
  | "storage"
  | "search"
  | "flags";

export type ProviderDescriptor = {
  readonly id: ProviderId;
  readonly family: ProviderFamily;
  readonly displayName: string;
  readonly fakeMode: boolean;
  readonly liveMode: boolean;
  readonly requiredEnv: readonly string[];
  readonly redactedFields: readonly string[];
  readonly notes: string;
};

export class ProviderConfigError extends Schema.TaggedErrorClass<ProviderConfigError>()(
  "ProviderConfigError",
  {
    provider: Schema.String,
    missingEnv: Schema.Array(Schema.String),
    invalidEnv: Schema.optional(Schema.Array(Schema.String)),
  },
) {}

export class ProviderCallError extends Schema.TaggedErrorClass<ProviderCallError>()(
  "ProviderCallError",
  {
    provider: Schema.String,
    publicMessage: Schema.String,
    retryable: Schema.Boolean,
  },
) {}

export type ProviderOperation =
  | "auth.ensureWorkspace"
  | "analytics.capture"
  | "billing.createCheckout"
  | "email.send"
  | "llm.complete"
  | "storage.putObject"
  | "search.query"
  | "flags.evaluate";

export type ProviderAdapterInput = {
  readonly operation: ProviderOperation;
  readonly workspaceSlug: string;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey?: string;
};

export type ProviderAdapterReceipt = {
  readonly provider: ProviderId;
  readonly mode: ProviderMode;
  readonly operation: ProviderOperation;
  readonly delivery: "fake" | "test" | "live-ready";
  readonly receiptId: string;
  readonly redactedPayload: Record<string, unknown>;
};

export type ProviderAdapter = {
  readonly provider: ProviderId;
  readonly mode: ProviderMode;
  readonly call: (
    input: ProviderAdapterInput,
  ) => Effect.Effect<ProviderAdapterReceipt, ProviderCallError>;
};

export const providerDescriptors = [
  {
    id: "workos",
    family: "auth",
    displayName: "WorkOS/AuthKit",
    fakeMode: true,
    liveMode: true,
    requiredEnv: ["WORKOS_API_KEY", "WORKOS_CLIENT_ID"],
    redactedFields: ["apiKey", "sessionToken", "organizationId"],
    notes:
      "Workspace membership and organization provisioning sit behind AuthWorkspace.",
  },
  {
    id: "posthog",
    family: "analytics",
    displayName: "PostHog",
    fakeMode: true,
    liveMode: true,
    requiredEnv: ["POSTHOG_PROJECT_TOKEN", "POSTHOG_HOST"],
    redactedFields: ["distinctId", "personProperties"],
    notes: "Event contracts are typed before live analytics is enabled.",
  },
  {
    id: "dodo",
    family: "billing",
    displayName: "Dodo",
    fakeMode: true,
    liveMode: true,
    requiredEnv: ["DODO_API_KEY", "DODO_WEBHOOK_SECRET"],
    redactedFields: ["apiKey", "webhookSecret", "customerEmail"],
    notes:
      "Billing defaults to fake packages, entitlements, and credit ledger state.",
  },
  {
    id: "email",
    family: "email",
    displayName: "Email (Postmark)",
    fakeMode: true,
    liveMode: true,
    requiredEnv: [
      "POSTMARK_SERVER_TOKEN",
      "EMAIL_TRANSACTIONAL_FROM",
      "EMAIL_MARKETING_FROM",
    ],
    redactedFields: ["recipient", "templateData", "templateModel"],
    notes:
      "Provider-neutral email uses Postmark outbound and broadcast streams in live mode.",
  },
  {
    id: "openrouter",
    family: "llm",
    displayName: "OpenRouter-compatible LLM",
    fakeMode: true,
    liveMode: true,
    requiredEnv: ["OPENROUTER_API_KEY"],
    redactedFields: ["apiKey", "prompt", "completion", "sourceContent"],
    notes:
      "Provider payloads are never public errors and source content is never instructions.",
  },
  {
    id: "storage",
    family: "storage",
    displayName: "Object Storage",
    fakeMode: true,
    liveMode: true,
    requiredEnv: [
      "STORAGE_BUCKET",
      "STORAGE_PUBLIC_BASE_URL",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ],
    redactedFields: ["signedUrl", "objectKey", "sourceExcerpt"],
    notes: "Signed URLs are scoped, expiring, and workspace-bound.",
  },
  {
    id: "search",
    family: "search",
    displayName: "Optional Search",
    fakeMode: true,
    liveMode: true,
    requiredEnv: ["SEARCH_PROVIDER", "SEARCH_API_KEY"],
    redactedFields: ["apiKey", "queryText", "documentChunk"],
    notes:
      "Vector/RAG retrieval is optional; source sets and context packs are core.",
  },
  {
    id: "flags",
    family: "flags",
    displayName: "Feature Flags",
    fakeMode: true,
    liveMode: true,
    requiredEnv: [],
    redactedFields: ["userEmail", "workspaceSlug", "targetingRule"],
    notes:
      "Local default flags support gradual rollout and kill-switch checks before a live provider is promoted.",
  },
] as const satisfies readonly ProviderDescriptor[];

export const providerIds = providerDescriptors.map((provider) => provider.id);

export const getProviderDescriptor = (
  id: ProviderId,
): ProviderDescriptor | undefined =>
  providerDescriptors.find((provider) => provider.id === id);

const commonRedactedFields = [
  "apiKey",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "webhookSecret",
  "authorization",
] as const;

export const validateProviderConfig = (
  id: ProviderId,
  mode: ProviderMode,
  env: Record<string, string | undefined>,
): true | ProviderConfigError => {
  if (mode !== "live") {
    return true;
  }

  const descriptor = getProviderDescriptor(id);
  const requiredEnv = descriptor?.requiredEnv ?? [];
  const missingEnv = requiredEnv.filter((name) => !env[name]?.trim());
  const invalidEnv = requiredEnv.filter((name) => {
    const value = env[name];

    return value !== undefined && value.trim() !== "" && value.trim() !== value;
  });

  if (missingEnv.length === 0 && invalidEnv.length === 0) {
    return true;
  }

  return new ProviderConfigError({
    provider: id,
    missingEnv,
    ...(invalidEnv.length === 0 ? {} : { invalidEnv }),
  });
};

export const redactProviderPayload = (
  id: ProviderId,
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const descriptor = getProviderDescriptor(id);
  const redacted = { ...payload };

  for (const field of [
    ...commonRedactedFields,
    ...(descriptor?.redactedFields ?? []),
  ]) {
    if (field in redacted) {
      redacted[field] = "[redacted]";
    }
  }

  return redacted;
};

export const providerConfigReport = (
  mode: ProviderMode,
  env: Record<string, string | undefined>,
) =>
  providerDescriptors.map((provider) => {
    const validation = validateProviderConfig(provider.id, mode, env);

    return {
      id: provider.id,
      displayName: provider.displayName,
      family: provider.family,
      mode,
      ready: validation === true,
      missingEnv: validation === true ? [] : validation.missingEnv,
      invalidEnv: validation === true ? [] : (validation.invalidEnv ?? []),
      requiredEnv: provider.requiredEnv,
      fakeMode: provider.fakeMode,
      liveMode: provider.liveMode,
    };
  });

const providerOperationByFamily = {
  auth: "auth.ensureWorkspace",
  analytics: "analytics.capture",
  billing: "billing.createCheckout",
  email: "email.send",
  llm: "llm.complete",
  storage: "storage.putObject",
  search: "search.query",
  flags: "flags.evaluate",
} as const satisfies Record<ProviderFamily, ProviderOperation>;

export const defaultProviderOperation = (id: ProviderId): ProviderOperation => {
  const descriptor = getProviderDescriptor(id);

  if (!descriptor) {
    return "analytics.capture";
  }

  return providerOperationByFamily[descriptor.family];
};
