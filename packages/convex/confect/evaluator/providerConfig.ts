import * as Config from "effect/Config";
import * as Option from "effect/Option";

const optionalEnvConfig = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined));

export const loadLlmGatewayEnvConfig = Config.all({
  OPENROUTER_API_KEY: optionalEnvConfig("OPENROUTER_API_KEY"),
  OPENROUTER_BASE_URL: optionalEnvConfig("OPENROUTER_BASE_URL"),
  LLM_FREE_MODEL: optionalEnvConfig("LLM_FREE_MODEL"),
  LLM_DAILY_SPEND_LIMIT_CENTS: optionalEnvConfig("LLM_DAILY_SPEND_LIMIT_CENTS"),
  LLM_DISABLED: optionalEnvConfig("LLM_DISABLED"),
});

export const loadDodoCommerceEnvConfig = Config.all({
  DODO_API_KEY: optionalEnvConfig("DODO_API_KEY"),
  DODO_WEBHOOK_SECRET: optionalEnvConfig("DODO_WEBHOOK_SECRET"),
  DODO_BUILD_PACK_PRODUCT_ID: optionalEnvConfig("DODO_BUILD_PACK_PRODUCT_ID"),
});
