export type WorkosConvexAuthConfig = {
  readonly providers: readonly [
    {
      readonly type: "customJwt";
      readonly issuer: string;
      readonly jwks: string;
      readonly algorithm: "RS256";
    },
  ];
};

export const deriveWorkosConvexAuthConfig = (input: {
  readonly applicationId: string;
}): WorkosConvexAuthConfig => ({
  providers: [
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${input.applicationId}`,
      jwks: `https://api.workos.com/sso/jwks/${input.applicationId}`,
      // Convex rejects customJwt providers without an explicit algorithm.
      algorithm: "RS256",
    },
  ],
});

const authConfig = deriveWorkosConvexAuthConfig({
  applicationId: process.env.WORKOS_CLIENT_ID ?? "client_fake_local_key",
});

export default authConfig;
