function isProviderHttpError(error: unknown): boolean {
  if (error === "HTTPError") return true;
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  return (
    candidate.name === "HTTPError" ||
    candidate.message === "HTTPError" ||
    (typeof candidate.status === "number" && candidate.status >= 400) ||
    (typeof candidate.response?.status === "number" &&
      candidate.response.status >= 400)
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
