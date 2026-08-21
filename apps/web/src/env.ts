export type WebEnv = {
  readonly VITE_CONVEX_URL: string;
};

export const isReferenceRoutesEnabled = (): boolean =>
  !import.meta.env.PROD &&
  import.meta.env.VITE_ENABLE_REFERENCE_ROUTES === "true";

export class WebEnvConfigError extends Error {
  readonly invalidEnv: readonly string[];

  constructor(input: { readonly invalidEnv: readonly string[] }) {
    super(`Invalid web environment values: ${input.invalidEnv.join(", ")}`);
    this.name = "WebEnvConfigError";
    this.invalidEnv = input.invalidEnv;
  }
}

// Convex requires a syntactically valid deployment-shaped hostname even when
// fake mode never claims a live backend. `convexConfigured` remains false, so
// product surfaces must describe this as an unconfigured backend.
const fallbackConvexUrl = "https://calm-finch-123.convex.cloud";

export type ResolvedWebEnv = {
  readonly env: WebEnv;
  readonly convexConfigured: boolean;
};

export const resolveWebEnv = (
  input: Readonly<Record<string, string | undefined>>,
): ResolvedWebEnv => {
  const convexUrl = input.VITE_CONVEX_URL;
  const trimmedConvexUrl = convexUrl?.trim();
  if (!trimmedConvexUrl) {
    return {
      env: { VITE_CONVEX_URL: fallbackConvexUrl },
      convexConfigured: false,
    };
  }
  if (convexUrl !== trimmedConvexUrl) {
    throw new WebEnvConfigError({ invalidEnv: ["VITE_CONVEX_URL"] });
  }
  return {
    env: { VITE_CONVEX_URL: convexUrl },
    convexConfigured: true,
  };
};

export const getWebEnv = (): WebEnv => resolveWebEnv(import.meta.env).env;

/**
 * True when a real deployment URL was baked in at build time. Static/local
 * builds without VITE_CONVEX_URL fall back to a placeholder host; live
 * features should render their "not configured" state instead of dialing it.
 */
export const isConvexConfigured = (): boolean =>
  resolveWebEnv(import.meta.env).convexConfigured;
