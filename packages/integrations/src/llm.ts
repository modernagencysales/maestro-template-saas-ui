import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";
import { redactProviderPayload } from "./index";
import {
  LlmReceiptValidationError,
  makeFakeLlmCompletionText,
  makeLlmCompletion,
  type LlmCompletion,
} from "./llmResponse";
import {
  calculateLlmSpend,
  estimateConservativeTokenCount,
  SpendCapExceededError,
  verifyDailySpendCap,
} from "./spend";

export class LlmDisabledError extends Schema.TaggedErrorClass<LlmDisabledError>()(
  "LlmDisabledError",
  {
    provider: Schema.Literal("openrouter"),
  },
) {}

export class LlmProviderConfigError extends Schema.TaggedErrorClass<LlmProviderConfigError>()(
  "LlmProviderConfigError",
  {
    provider: Schema.Literal("openrouter"),
    missingEnv: Schema.Array(Schema.String),
  },
) {}

export class LlmProviderCallError extends Schema.TaggedErrorClass<LlmProviderCallError>()(
  "LlmProviderCallError",
  {
    provider: Schema.Literal("openrouter"),
    publicMessage: Schema.String,
    retryable: Schema.Boolean,
    redactedPayload: Schema.Record(Schema.String, Schema.Unknown),
  },
) {}

export type LlmGatewayError =
  | LlmDisabledError
  | LlmProviderConfigError
  | LlmProviderCallError
  | LlmReceiptValidationError
  | SpendCapExceededError
  | LlmRequestLimitError;

export class LlmRequestLimitError extends Schema.TaggedErrorClass<LlmRequestLimitError>()(
  "LlmRequestLimitError",
  {
    limit: Schema.Union([
      Schema.Literal("input-tokens"),
      Schema.Literal("output-tokens"),
    ]),
    actual: Schema.Number,
    maximum: Schema.Number,
  },
) {}

export type LlmPricing = {
  readonly inputCentsPerMillionTokens: number;
  readonly outputCentsPerMillionTokens: number;
  readonly minimumCents: number;
};

export type LlmCallLimits = {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
};

export type LlmGatewayRequest = {
  readonly workspaceSlug: string;
  readonly prompt: string;
  readonly model?: string;
  readonly modelEnv?: "LLM_FREE_MODEL" | "LLM_PREMIUM_MODEL";
  readonly pricing?: LlmPricing;
  readonly limits?: LlmCallLimits;
  readonly idempotencyKey?: string;
  readonly expectedCompletionTokens?: number;
  readonly currentDailySpendCents?: number;
};

export type LlmProviderTransportInput = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly prompt: string;
  readonly maxOutputTokens?: number;
};

export type LlmProviderTransportResult = {
  readonly text: string;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const createOpenRouterTransport =
  (fetcher: Fetcher = fetch): NonNullable<LlmGatewayConfig["transport"]> =>
  (input) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetcher(`${input.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            messages: [{ role: "user", content: input.prompt }],
            ...(input.maxOutputTokens === undefined
              ? {}
              : { max_tokens: input.maxOutputTokens }),
          }),
        });
        if (!response.ok) {
          throw new Error(
            `OpenRouter returned HTTP ${String(response.status)}.`,
          );
        }
        const body = (await response.json()) as {
          readonly choices?: readonly {
            readonly message?: { readonly content?: unknown };
          }[];
        };
        const text = body.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) {
          throw new Error("OpenRouter returned an empty completion.");
        }
        return { text };
      },
      catch: (error) => error,
    });

export type LlmTelemetryEvent = {
  readonly provider: "openrouter";
  readonly mode: ProviderMode;
  readonly workspaceSlug: string;
  readonly estimatedCents: number;
};

export type LlmGatewayConfig = {
  readonly mode: ProviderMode;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly now?: () => string;
  readonly transport?: (
    input: LlmProviderTransportInput,
  ) => Effect.Effect<LlmProviderTransportResult, unknown>;
  readonly captureTelemetry?: (
    event: LlmTelemetryEvent,
  ) => void | Promise<void>;
  readonly fakeCompletionText?: (request: LlmGatewayRequest) => string;
};

export type LlmGateway = {
  readonly complete: (
    request: LlmGatewayRequest,
  ) => Effect.Effect<LlmCompletion, LlmGatewayError>;
};

const defaultModel = "fake/local-demo";
const defaultBaseUrl = "https://openrouter.ai/api/v1";

const readEnv = (
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined => {
  const value = env[name]?.trim();

  return value ? value : undefined;
};

const llmDisabled = (
  env: Readonly<Record<string, string | undefined>>,
): boolean => readEnv(env, "LLM_DISABLED")?.toLowerCase() === "true";

const requireOpenRouterApiKey = (
  env: Readonly<Record<string, string | undefined>>,
): string | LlmProviderConfigError => {
  const apiKey = readEnv(env, "OPENROUTER_API_KEY");

  if (apiKey) {
    return apiKey;
  }

  return new LlmProviderConfigError({
    provider: "openrouter",
    missingEnv: ["OPENROUTER_API_KEY"],
  });
};

const spendForRequest = (request: LlmGatewayRequest) => {
  const promptTokens = estimateConservativeTokenCount(request.prompt);
  const completionTokens =
    request.expectedCompletionTokens ?? request.limits?.maxOutputTokens ?? 256;

  return calculateLlmSpend({
    promptTokens,
    completionTokens,
    inputCentsPerMillionTokens:
      request.pricing?.inputCentsPerMillionTokens ?? 20,
    outputCentsPerMillionTokens:
      request.pricing?.outputCentsPerMillionTokens ?? 40,
    minimumCents: request.pricing?.minimumCents ?? 1,
  });
};

const captureTelemetrySafely = (
  capture: LlmGatewayConfig["captureTelemetry"],
  event: LlmTelemetryEvent,
) =>
  Effect.tryPromise({
    try: async () => {
      await capture?.(event);
    },
    catch: () => undefined,
  }).pipe(Effect.catch(() => Effect.succeed(undefined)));

const createProviderCallError = (
  input: LlmProviderTransportInput,
): LlmProviderCallError =>
  new LlmProviderCallError({
    provider: "openrouter",
    publicMessage: "LLM provider request failed.",
    retryable: true,
    redactedPayload: redactProviderPayload("openrouter", {
      apiKey: input.apiKey,
      prompt: input.prompt,
      model: input.model,
      baseUrl: input.baseUrl,
    }),
  });

export const createLlmGateway = (config: LlmGatewayConfig): LlmGateway => ({
  complete: (request) =>
    Effect.gen(function* () {
      if (llmDisabled(config.env)) {
        return yield* Effect.fail(
          new LlmDisabledError({ provider: "openrouter" }),
        );
      }

      const usage = spendForRequest(request);
      if (
        request.limits &&
        usage.promptTokens > request.limits.maxInputTokens
      ) {
        return yield* Effect.fail(
          new LlmRequestLimitError({
            limit: "input-tokens",
            actual: usage.promptTokens,
            maximum: request.limits.maxInputTokens,
          }),
        );
      }
      if (
        request.limits &&
        usage.completionTokens > request.limits.maxOutputTokens
      ) {
        return yield* Effect.fail(
          new LlmRequestLimitError({
            limit: "output-tokens",
            actual: usage.completionTokens,
            maximum: request.limits.maxOutputTokens,
          }),
        );
      }
      const dailyLimit = Number(
        readEnv(config.env, "LLM_DAILY_SPEND_LIMIT_CENTS") ?? "2500",
      );
      const cap = verifyDailySpendCap({
        workspaceSlug: request.workspaceSlug,
        currentDailySpendCents: request.currentDailySpendCents ?? 0,
        estimatedCallCents: usage.estimatedCents,
        dailySpendLimitCents: dailyLimit,
      });

      if (cap !== true) {
        return yield* Effect.fail(cap);
      }

      const model =
        request.model ??
        (request.modelEnv === undefined
          ? undefined
          : readEnv(config.env, request.modelEnv)) ??
        readEnv(config.env, "LLM_DEFAULT_MODEL") ??
        defaultModel;
      const generatedAt = config.now?.() ?? new Date().toISOString();

      const text =
        config.mode === "fake"
          ? (config.fakeCompletionText?.(request) ??
            makeFakeLlmCompletionText(request.workspaceSlug))
          : yield* Effect.gen(function* () {
              const apiKey = requireOpenRouterApiKey(config.env);

              if (apiKey instanceof LlmProviderConfigError) {
                return yield* Effect.fail(apiKey);
              }

              const transportInput = {
                apiKey,
                baseUrl:
                  readEnv(config.env, "OPENROUTER_BASE_URL") ?? defaultBaseUrl,
                model,
                prompt: request.prompt,
                ...(request.limits === undefined
                  ? {}
                  : { maxOutputTokens: request.limits.maxOutputTokens }),
              };
              const transport = config.transport ?? createOpenRouterTransport();
              const result = yield* transport(transportInput).pipe(
                Effect.mapError(() => createProviderCallError(transportInput)),
              );

              return result.text;
            });

      const completion = makeLlmCompletion({
        mode: config.mode,
        model,
        workspaceSlug: request.workspaceSlug,
        text,
        usage,
        generatedAt,
        ...(request.idempotencyKey
          ? { idempotencyKey: request.idempotencyKey }
          : {}),
      });

      if (completion instanceof LlmReceiptValidationError) {
        return yield* Effect.fail(completion);
      }

      yield* captureTelemetrySafely(config.captureTelemetry, {
        provider: "openrouter",
        mode: config.mode,
        workspaceSlug: request.workspaceSlug,
        estimatedCents: usage.estimatedCents,
      });

      return completion;
    }),
});
