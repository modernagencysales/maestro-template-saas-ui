import * as Config from "effect/Config";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export {
  loadTemplateRuntimeConfig,
  runWithTemplateRuntimeConfig,
  TemplateRuntimeConfigLive,
} from "./config";
export type { RuntimeMode, TemplateRuntimeConfigShape } from "./config";

export type ProviderMode = "fake" | "test" | "live";

export type EnvSource = Readonly<Record<string, string | undefined>>;

const optionalEnvConfig = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined));

export const loadLlmGatewayEnvConfig = Config.all({
  OPENROUTER_API_KEY: optionalEnvConfig("OPENROUTER_API_KEY"),
  OPENROUTER_BASE_URL: optionalEnvConfig("OPENROUTER_BASE_URL"),
  LLM_FREE_MODEL: optionalEnvConfig("LLM_FREE_MODEL"),
  LLM_DAILY_SPEND_LIMIT_CENTS: optionalEnvConfig("LLM_DAILY_SPEND_LIMIT_CENTS"),
  LLM_DISABLED: optionalEnvConfig("LLM_DISABLED"),
});

export class EnvConfigError extends Schema.TaggedErrorClass<EnvConfigError>()(
  "EnvConfigError",
  {
    name: Schema.String,
    reason: Schema.Literals(["missing", "blank", "whitespace"]),
  },
) {}

const makeEnvConfigError = (
  name: string,
  reason: "missing" | "blank" | "whitespace",
): EnvConfigError => {
  const error = new EnvConfigError({ name, reason });
  const label =
    reason === "missing"
      ? "Missing"
      : reason === "blank"
        ? "Blank"
        : "Whitespace-contaminated";

  Object.defineProperty(error, "message", {
    value: `${label} required env: ${name}`,
  });

  return error;
};

const trimEnvValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
};

export const readOptionalEnv = (
  name: string,
  env: EnvSource,
): string | undefined => trimEnvValue(env[name]);

export const readNodeEnvironment = (): "production" | "test" | undefined => {
  const value = process.env.NODE_ENV;
  return value === "production" || value === "test" ? value : undefined;
};

export const readPromotionAuthorityPrivateKeyPkcs8Base64Url = () =>
  process.env.PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL;

export const readRequiredEnv = (name: string, env: EnvSource): string => {
  if (!(name in env)) {
    throw makeEnvConfigError(name, "missing");
  }

  const rawValue = env[name];
  const value = trimEnvValue(rawValue);

  if (!value) {
    throw makeEnvConfigError(name, "blank");
  }

  if (rawValue !== value) {
    throw makeEnvConfigError(name, "whitespace");
  }

  return value;
};

export const requireLiveEnv = (
  names: readonly string[],
  mode: ProviderMode,
  env: EnvSource,
): Readonly<Record<string, string>> => {
  if (mode === "fake") {
    return {};
  }

  return Object.fromEntries(
    names.map((name) => [name, readRequiredEnv(name, env)]),
  );
};

export const killSwitchOn = (env: EnvSource): boolean =>
  readOptionalEnv("LLM_DISABLED", env)?.toLowerCase() === "true";
