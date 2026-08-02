import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export type RuntimeMode = "fake" | "test" | "live";

export type TemplateRuntimeConfigShape = {
  readonly runtimeMode: RuntimeMode;
  readonly publicBaseUrl: string;
};

export const RuntimeModeConfig = Config.literals(
  ["fake", "test", "live"],
  "TEMPLATE_RUNTIME_MODE",
).pipe(Config.withDefault("fake" as const));

export const PublicBaseUrlConfig = Config.string(
  "TEMPLATE_PUBLIC_BASE_URL",
).pipe(Config.withDefault("http://localhost:5173"));

export class TemplateRuntimeConfig extends Context.Service<
  TemplateRuntimeConfig,
  TemplateRuntimeConfigShape
>()("TemplateRuntimeConfig") {}

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
  E | Config.ConfigError,
  Exclude<R, TemplateRuntimeConfig>
> => {
  const providedEffect = effect.pipe(Effect.provide(TemplateRuntimeConfigLive));
  return providedEffect.pipe(
    Effect.provide(ConfigProvider.layer(provider ?? ConfigProvider.fromEnv())),
  );
};
