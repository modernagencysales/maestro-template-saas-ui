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

export const loadMailerSendEnvConfig = Config.all({
  MAILERSEND_API_KEY: optionalEnvConfig("MAILERSEND_API_KEY"),
  MAILERSEND_FROM_EMAIL: optionalEnvConfig("MAILERSEND_FROM_EMAIL"),
});

export const loadDodoCommerceEnvConfig = Config.all({
  DODO_API_KEY: optionalEnvConfig("DODO_API_KEY"),
  DODO_WEBHOOK_SECRET: optionalEnvConfig("DODO_WEBHOOK_SECRET"),
  DODO_BUILD_PACK_PRODUCT_ID: optionalEnvConfig("DODO_BUILD_PACK_PRODUCT_ID"),
  DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS: optionalEnvConfig(
    "DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS",
  ),
  DODO_BUILD_PACK_EXPECTED_CURRENCY: optionalEnvConfig(
    "DODO_BUILD_PACK_EXPECTED_CURRENCY",
  ),
  DODO_BUILD_PACK_LAUNCH_CANARY: optionalEnvConfig(
    "DODO_BUILD_PACK_LAUNCH_CANARY",
  ),
});

export const loadAdmaxxerEnvConfig = Config.all({
  ADMAXXER_API_KEY: optionalEnvConfig("ADMAXXER_API_KEY"),
});
