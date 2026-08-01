import * as Config from "effect/Config";
import * as ConfigError from "effect/ConfigError";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

export type RuntimeMode = "fake" | "test" | "live";

export type TemplateRuntimeConfigShape = {
  readonly runtimeMode: RuntimeMode;
  readonly publicBaseUrl: string;
};

export const RuntimeModeConfig = Config.literal(
  "fake",
  "test",
  "live",
)("TEMPLATE_RUNTIME_MODE").pipe(Config.withDefault("fake" as const));

export const PublicBaseUrlConfig = Config.string(
  "TEMPLATE_PUBLIC_BASE_URL",
).pipe(Config.withDefault("http://localhost:5173"));

const optionalEnvConfig = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined));

export const loadLlmGatewayEnvConfig = Config.all({
  OPENROUTER_API_KEY: optionalEnvConfig("OPENROUTER_API_KEY"),
  OPENROUTER_BASE_URL: optionalEnvConfig("OPENROUTER_BASE_URL"),
  LLM_FREE_MODEL: optionalEnvConfig("LLM_FREE_MODEL"),
  LLM_DAILY_SPEND_LIMIT_CENTS: optionalEnvConfig("LLM_DAILY_SPEND_LIMIT_CENTS"),
  LLM_DISABLED: optionalEnvConfig("LLM_DISABLED"),
});

export class TemplateRuntimeConfig extends Context.Tag("TemplateRuntimeConfig")<
  TemplateRuntimeConfig,
  TemplateRuntimeConfigShape
>() {}

export const TemplateRuntimeConfigLive = Layer.effect(
  TemplateRuntimeConfig,
  Effect.gen(function* () {
    return {
      runtimeMode: yield* RuntimeModeConfig,
      publicBaseUrl: yield* PublicBaseUrlConfig,
    };
  }),
);

export const loadTemplateRuntimeConfig = TemplateRuntimeConfig;

export const runWithTemplateRuntimeConfig = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  provider?: ConfigProvider.ConfigProvider,
): Effect.Effect<
  A,
  E | ConfigError.ConfigError,
  Exclude<R, TemplateRuntimeConfig>
> => {
  const providedEffect = effect.pipe(Effect.provide(TemplateRuntimeConfigLive));

  if (provider === undefined) {
    return providedEffect;
  }

  return providedEffect.pipe(Effect.withConfigProvider(provider));
};
