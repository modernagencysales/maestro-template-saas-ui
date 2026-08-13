// eslint-disable-next-line complexity -- checks the provider's several error shapes at one boundary.
function isProviderHttpError(
  error: unknown,
  seen = new WeakSet<object>(),
): boolean {
  if (error === "HTTPError") return true;
  if (typeof error !== "object" || error === null) return false;
  if (seen.has(error)) return false;
  seen.add(error);
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    cause?: unknown;
  };
  return (
    candidate.name === "HTTPError" ||
    candidate.message === "HTTPError" ||
    (typeof candidate.status === "number" && candidate.status >= 400) ||
    (typeof candidate.response?.status === "number" &&
      candidate.response.status >= 400) ||
    isProviderHttpError(candidate.cause, seen)
  );
}

export function guardedCallback(
  handler: (args: { request: Request }) => Response | Promise<Response>,
) {
  return async (args: { request: Request }) => {
    try {
      return await handler(args);
    } catch (error) {
      if (!isProviderHttpError(error)) throw error;
      return new Response(
        JSON.stringify({ error: "auth_provider_unavailable" }),
        {
          status: 502,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
  };
}
