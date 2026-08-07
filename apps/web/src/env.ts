export type WebEnv = {
  readonly VITE_CONVEX_URL: string;
};

export class WebEnvConfigError extends Error {
  readonly invalidEnv: readonly string[];

  constructor(input: { readonly invalidEnv: readonly string[] }) {
    super(`Invalid web environment values: ${input.invalidEnv.join(", ")}`);
    this.name = "WebEnvConfigError";
    this.invalidEnv = input.invalidEnv;
  }
}

const fallbackConvexUrl = "https://example-template.convex.cloud";

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

export const isContractMode = (
  input: Readonly<Record<string, string | undefined>> = import.meta.env,
): boolean => input.VITE_MAESTRO_CONTRACT_MODE === "1";

/**
 * True when a real deployment URL was baked in at build time. Static/local
 * builds without VITE_CONVEX_URL fall back to a placeholder host; live
 * features should render their "not configured" state instead of dialing it.
 */
export const isConvexConfigured = (): boolean =>
  resolveWebEnv(import.meta.env).convexConfigured;
