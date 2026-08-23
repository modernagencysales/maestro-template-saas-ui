export type WebAuthMode = "fixture" | "workos";

type AuthEnvironment = Readonly<{
  APP_ENV?: string;
  APP_PROVIDER_MODE?: string;
  VITE_MAESTRO_AUTH_MODE?: string;
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_COOKIE_PASSWORD?: string;
  WORKOS_REDIRECT_URI?: string;
}>;

const productionWorkosVariables = [
  "WORKOS_CLIENT_ID",
  "WORKOS_API_KEY",
  "WORKOS_REDIRECT_URI",
  "WORKOS_COOKIE_PASSWORD",
] as const;

export function resolveWebAuthMode(environment: AuthEnvironment): WebAuthMode {
  const explicit = environment.VITE_MAESTRO_AUTH_MODE;
  if (
    explicit !== undefined &&
    explicit !== "fixture" &&
    explicit !== "workos"
  ) {
    throw new Error(`Unknown VITE_MAESTRO_AUTH_MODE: ${explicit}`);
  }
  const requested =
    explicit ??
    (environment.APP_PROVIDER_MODE === "fake" ? "fixture" : "workos");
  if (environment.APP_ENV === "production" && requested === "fixture") {
    throw new Error("Fixture authentication is forbidden in production.");
  }
  return requested;
}

export function buildRequestMiddleware<Middleware>(input: {
  readonly mode: WebAuthMode;
  readonly csrf: Middleware;
  readonly createWorkos: () => Middleware;
}): readonly Middleware[] {
  return input.mode === "fixture"
    ? [input.csrf]
    : [input.csrf, input.createWorkos()];
}

export function assertProductionAuthConfiguration(
  environment: AuthEnvironment,
): void {
  if (environment.APP_ENV !== "production") return;
  const mode = resolveWebAuthMode(environment);
  if (mode !== "workos") return;
  const missing = productionWorkosVariables.filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Production WorkOS configuration is missing: ${missing.join(", ")}`,
    );
  }
}
