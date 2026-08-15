import * as Schema from "effect/Schema";
import type { ProviderMode } from "./index";

export class WorkosConfigError extends Schema.TaggedErrorClass<WorkosConfigError>()(
  "WorkosConfigError",
  {
    missingEnv: Schema.Array(Schema.String),
    invalidEnv: Schema.Array(Schema.String),
  },
) {}

export type FakeAuthKitClient = {
  readonly mode: "fake";
  readonly getSignInUrl: (state: string) => string;
  readonly getSignOutUrl: () => string;
};

export type AuthKitRouteRegistration = {
  readonly callback: {
    readonly path: string;
    readonly redirectUri: string;
  };
  readonly logout: {
    readonly path: string;
    readonly logoutUri: string;
  };
};

export type WorkosSignatureFailureReason =
  "missing_signature" | "stale_timestamp" | "invalid_signature";

export type WorkosSignatureFailure = {
  readonly reason: WorkosSignatureFailureReason;
  readonly retryable: boolean;
};

export type WorkosConvexAuthConfig = {
  readonly providers: readonly [
    {
      readonly type: "customJwt";
      readonly issuer: string;
      readonly jwks: string;
    },
  ];
};

const requiredLiveEnv = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "WORKOS_REDIRECT_URI",
] as const;

export const validateWorkosEnv = (
  mode: ProviderMode,
  env: Readonly<Record<string, string | undefined>>,
): true | WorkosConfigError => {
  if (mode === "fake") {
    return true;
  }

  const missingEnv: Array<(typeof requiredLiveEnv)[number]> = [];
  const invalidEnv: Array<(typeof requiredLiveEnv)[number]> = [];

  for (const name of requiredLiveEnv) {
    const value = env[name];
    const trimmed = value?.trim();
    if (!trimmed) {
      missingEnv.push(name);
      continue;
    }
    if (value !== trimmed) {
      invalidEnv.push(name);
    }
  }

  return missingEnv.length > 0 || invalidEnv.length > 0
    ? new WorkosConfigError({
        missingEnv: [...missingEnv],
        invalidEnv: [...invalidEnv],
      })
    : true;
};

export const createFakeAuthKitClient = (input: {
  readonly baseUrl: string;
  readonly organizationId: string;
}): FakeAuthKitClient => ({
  mode: "fake",
  getSignInUrl: (state) =>
    `${input.baseUrl}/auth/fake/sign-in?organization_id=${input.organizationId}&state=${state}`,
  getSignOutUrl: () => `${input.baseUrl}/auth/fake/sign-out`,
});

export const createAuthKitRouteRegistration = (input: {
  readonly callbackPath: string;
  readonly logoutPath: string;
  readonly redirectUri: string;
  readonly logoutUri: string;
}): AuthKitRouteRegistration => ({
  callback: {
    path: input.callbackPath,
    redirectUri: input.redirectUri,
  },
  logout: {
    path: input.logoutPath,
    logoutUri: input.logoutUri,
  },
});

export const classifyWorkosSignatureFailure = (input: {
  readonly hasSignature: boolean;
  readonly timestampSkewMs: number;
  readonly verified: boolean;
}): WorkosSignatureFailure | undefined => {
  if (input.verified) {
    return undefined;
  }

  if (!input.hasSignature) {
    return { reason: "missing_signature", retryable: false };
  }

  if (input.timestampSkewMs > 300_000) {
    return { reason: "stale_timestamp", retryable: false };
  }

  return { reason: "invalid_signature", retryable: false };
};

export const deriveWorkosConvexAuthConfig = (input: {
  readonly applicationId: string;
}): WorkosConvexAuthConfig => ({
  providers: [
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${input.applicationId}`,
      jwks: `https://api.workos.com/sso/jwks/${input.applicationId}`,
    },
  ],
});
