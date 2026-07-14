export type ServerEnvSource = Readonly<Record<string, string | undefined>>;

const requiredWorkosEnv = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "WORKOS_REDIRECT_URI",
  "WORKOS_LOGOUT_URI",
  "WORKOS_AUTHKIT_ISSUER",
  "WORKOS_AUTHKIT_JWKS_URL",
] as const;

export class ServerEnvConfigError extends Error {
  readonly invalidEnv: readonly string[];

  constructor(input: { readonly invalidEnv: readonly string[] }) {
    super(`Invalid server environment values: ${input.invalidEnv.join(", ")}`);
    this.name = "ServerEnvConfigError";
    this.invalidEnv = input.invalidEnv;
  }
}

export const readRequiredServerEnv = (
  name: string,
  env: ServerEnvSource,
): string => {
  const rawValue = env[name];
  const value = rawValue?.trim();

  if (!value || rawValue !== value) {
    throw new ServerEnvConfigError({ invalidEnv: [name] });
  }

  return value;
};

export const hasWorkosServerEnv = (env: ServerEnvSource): boolean =>
  requiredWorkosEnv.every((name) => {
    try {
      readRequiredServerEnv(name, env);
      return true;
    } catch {
      return false;
    }
  });

export const getServerEnv = (): ServerEnvSource => {
  const maybeProcess = globalThis as typeof globalThis & {
    readonly process?: { readonly env?: ServerEnvSource };
  };

  return maybeProcess.process?.env ?? {};
};
