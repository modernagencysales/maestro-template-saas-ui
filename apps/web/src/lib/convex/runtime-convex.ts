const fixtureConvexUrl = "http://127.0.0.1:3210";

export function resolveRuntimeConvex(input: {
  readonly fixture: boolean;
  readonly url: string | undefined;
}): { readonly connect: boolean; readonly url: string } {
  const url = input.url?.trim();
  if (input.fixture) {
    return { connect: false, url: url || fixtureConvexUrl };
  }
  if (!url) throw new Error("VITE_CONVEX_URL is required in live mode.");
  return { connect: true, url };
}
