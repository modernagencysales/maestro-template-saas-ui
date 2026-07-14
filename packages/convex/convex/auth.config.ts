export type WorkosConvexAuthConfig = {
  readonly providers: readonly [
    {
      readonly type: "customJwt";
      readonly issuer: string;
      readonly jwks: string;
      readonly applicationID: string;
      readonly algorithm: "RS256";
    },
  ];
};

export type ConvexAuthEnvSource = Readonly<Record<string, string | undefined>>;

export class AuthConfigurationInvalid extends Error {
  readonly invalidEnv: readonly string[];

  constructor(input: { readonly invalidEnv: readonly string[] }) {
    super(`AuthConfigurationInvalid: ${input.invalidEnv.join(", ")}`);
    this.name = "AuthConfigurationInvalid";
    this.invalidEnv = input.invalidEnv;
  }
}

export const deriveWorkosConvexAuthConfig = (input: {
  readonly issuer: string;
  readonly jwksUrl: string;
  readonly applicationId: string;
}): WorkosConvexAuthConfig => ({
  providers: [
    {
      type: "customJwt",
      issuer: input.issuer,
      jwks: input.jwksUrl,
      applicationID: input.applicationId,
      // Convex rejects customJwt providers without an explicit algorithm.
      algorithm: "RS256",
    },
  ],
});

const fakeAuthConfig = deriveWorkosConvexAuthConfig({
  issuer: "https://api.workos.com",
  jwksUrl: "https://api.workos.com/sso/jwks/org_acme_demo",
  applicationId: "client_fake_local_key",
});

const fakeProviderModes = new Set(["fake", "local"]);
const productionModes = new Set(["prod", "production", "live"]);

const requiredLiveEnv = [
  "WORKOS_CLIENT_ID",
  "WORKOS_AUTHKIT_ISSUER",
  "WORKOS_AUTHKIT_JWKS_URL",
] as const;

const getEnv = (): ConvexAuthEnvSource => {
  const maybeProcess = globalThis as typeof globalThis & {
    readonly process?: { readonly env?: ConvexAuthEnvSource };
  };

  return maybeProcess.process?.env ?? {};
};

const isProductionEnv = (env: ConvexAuthEnvSource): boolean =>
  productionModes.has((env.APP_ENV ?? "").trim().toLowerCase()) ||
  productionModes.has((env.NODE_ENV ?? "").trim().toLowerCase());

const providerModeFor = (env: ConvexAuthEnvSource): string =>
  (env.APP_PROVIDER_MODE ?? env.AUTH_PROVIDER_MODE ?? "fake")
    .trim()
    .toLowerCase();

const readRequired = (name: string, env: ConvexAuthEnvSource): string => {
  const rawValue = env[name];
  const value = rawValue?.trim();

  if (!value || rawValue !== value) {
    throw new AuthConfigurationInvalid({ invalidEnv: [name] });
  }

  return value;
};

const isValidHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const loadWorkosConvexAuthConfig = (
  env: ConvexAuthEnvSource = getEnv(),
): WorkosConvexAuthConfig => {
  const providerMode = providerModeFor(env);

  if (fakeProviderModes.has(providerMode)) {
    if (isProductionEnv(env)) {
      throw new AuthConfigurationInvalid({ invalidEnv: ["APP_PROVIDER_MODE"] });
    }

    return fakeAuthConfig;
  }

  const values: Record<(typeof requiredLiveEnv)[number], string> = {
    WORKOS_CLIENT_ID: readRequired("WORKOS_CLIENT_ID", env),
    WORKOS_AUTHKIT_ISSUER: readRequired("WORKOS_AUTHKIT_ISSUER", env),
    WORKOS_AUTHKIT_JWKS_URL: readRequired("WORKOS_AUTHKIT_JWKS_URL", env),
  };

  const urlEnv = ["WORKOS_AUTHKIT_ISSUER", "WORKOS_AUTHKIT_JWKS_URL"] as const;
  const invalidUrls = urlEnv.filter((name) => !isValidHttpsUrl(values[name]));
  if (invalidUrls.length > 0) {
    throw new AuthConfigurationInvalid({ invalidEnv: invalidUrls });
  }

  return deriveWorkosConvexAuthConfig({
    issuer: values.WORKOS_AUTHKIT_ISSUER,
    jwksUrl: values.WORKOS_AUTHKIT_JWKS_URL,
    applicationId: values.WORKOS_CLIENT_ID,
  });
};

export default loadWorkosConvexAuthConfig();
