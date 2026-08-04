import { providerDescriptors } from "@maestro-template/integrations";
import type { CliRuntimeConfig } from "./types";

export const emptyCliRuntimeConfig: CliRuntimeConfig = {
  providerEnv: {},
};

const cliProviderEnvNames = [
  ...new Set(
    providerDescriptors.flatMap((descriptor) => descriptor.requiredEnv),
  ),
];

export const decodeCliRuntimeConfig = (
  env: Readonly<Record<string, string | undefined>>,
): CliRuntimeConfig => ({
  providerEnv: Object.fromEntries(
    cliProviderEnvNames.map((name) => [name, env[name]]),
  ),
  ...(env.MAESTRO_API_BASE_URL === undefined
    ? {}
    : { apiBaseUrl: env.MAESTRO_API_BASE_URL }),
  ...(env.MAESTRO_API_KEY === undefined ? {} : { apiKey: env.MAESTRO_API_KEY }),
});
