import {
  getAuth,
  type NoUserInfo,
  type UserInfo,
} from "@workos/authkit-tanstack-react-start";

import { readRequiredServerEnv, type ServerEnvSource } from "../server-env";

export type AuthSnapshot =
  | { readonly status: "signedOut" }
  | {
      readonly status: "authenticated";
      readonly subject: string;
      readonly email: string;
      readonly organizationId: string;
      readonly accessToken: string;
    };

export class Unauthorized extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "Unauthorized";
  }
}

export class AuthConfigurationInvalid extends Error {
  readonly invalidEnv: readonly string[];

  constructor(input: { readonly invalidEnv: readonly string[] }) {
    super(`AuthConfigurationInvalid: ${input.invalidEnv.join(", ")}`);
    this.name = "AuthConfigurationInvalid";
    this.invalidEnv = input.invalidEnv;
  }
}

export type AuthKitRuntimeConfig =
  | { readonly mode: "fake" }
  | {
      readonly mode: "live" | "test";
      readonly clientId: string;
      readonly redirectUri: string;
      readonly logoutUri: string;
      readonly issuer: string;
      readonly jwksUrl: string;
    };

export type WorkosServerAuth = UserInfo | NoUserInfo;

const fakeProviderModes = new Set(["fake", "local"]);
const productionModes = new Set(["prod", "production", "live"]);

const isProductionEnv = (env: ServerEnvSource): boolean =>
  productionModes.has((env.APP_ENV ?? "").trim().toLowerCase()) ||
  productionModes.has((env.NODE_ENV ?? "").trim().toLowerCase());

const providerModeFor = (env: ServerEnvSource): string =>
  (env.APP_PROVIDER_MODE ?? env.AUTH_PROVIDER_MODE ?? "fake")
    .trim()
    .toLowerCase();

const requiredLiveEnv = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "WORKOS_REDIRECT_URI",
  "WORKOS_LOGOUT_URI",
  "WORKOS_AUTHKIT_ISSUER",
  "WORKOS_AUTHKIT_JWKS_URL",
] as const;

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
};

const readLiveEnv = (name: string, env: ServerEnvSource): string => {
  try {
    return readRequiredServerEnv(name, env);
  } catch {
    throw new AuthConfigurationInvalid({ invalidEnv: [name] });
  }
};

export const buildAuthKitRuntimeConfig = (
  env: ServerEnvSource,
): AuthKitRuntimeConfig => {
  const providerMode = providerModeFor(env);

  if (fakeProviderModes.has(providerMode)) {
    if (isProductionEnv(env)) {
      throw new AuthConfigurationInvalid({ invalidEnv: ["APP_PROVIDER_MODE"] });
    }
    return { mode: "fake" };
  }

  const values: Record<(typeof requiredLiveEnv)[number], string> = {
    WORKOS_API_KEY: readLiveEnv("WORKOS_API_KEY", env),
    WORKOS_CLIENT_ID: readLiveEnv("WORKOS_CLIENT_ID", env),
    WORKOS_COOKIE_PASSWORD: readLiveEnv("WORKOS_COOKIE_PASSWORD", env),
    WORKOS_REDIRECT_URI: readLiveEnv("WORKOS_REDIRECT_URI", env),
    WORKOS_LOGOUT_URI: readLiveEnv("WORKOS_LOGOUT_URI", env),
    WORKOS_AUTHKIT_ISSUER: readLiveEnv("WORKOS_AUTHKIT_ISSUER", env),
    WORKOS_AUTHKIT_JWKS_URL: readLiveEnv("WORKOS_AUTHKIT_JWKS_URL", env),
  };
  const urlEnv = [
    "WORKOS_REDIRECT_URI",
    "WORKOS_LOGOUT_URI",
    "WORKOS_AUTHKIT_ISSUER",
    "WORKOS_AUTHKIT_JWKS_URL",
  ] as const;
  const invalidUrls = urlEnv.filter((name) => !isValidUrl(values[name]));

  if (invalidUrls.length > 0) {
    throw new AuthConfigurationInvalid({ invalidEnv: invalidUrls });
  }

  return {
    mode: providerMode === "test" ? "test" : "live",
    clientId: values.WORKOS_CLIENT_ID,
    redirectUri: values.WORKOS_REDIRECT_URI,
    logoutUri: values.WORKOS_LOGOUT_URI,
    issuer: values.WORKOS_AUTHKIT_ISSUER,
    jwksUrl: values.WORKOS_AUTHKIT_JWKS_URL,
  };
};

export const toAuthSnapshot = (auth: WorkosServerAuth): AuthSnapshot => {
  if (!auth.user) return { status: "signedOut" };

  if (
    !auth.user.id ||
    !auth.user.email ||
    !auth.organizationId ||
    !auth.accessToken
  ) {
    throw new Unauthorized();
  }

  return {
    status: "authenticated",
    subject: auth.user.id,
    email: auth.user.email,
    organizationId: auth.organizationId,
    accessToken: auth.accessToken,
  };
};

export async function getAuthSnapshot(
  input: {
    readonly getAuth?: () => Promise<WorkosServerAuth>;
  } = {},
): Promise<AuthSnapshot> {
  return toAuthSnapshot(await (input.getAuth ?? getAuth)());
}
