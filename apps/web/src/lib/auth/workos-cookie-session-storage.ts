import { CookieSessionStorage, type HeadersBag } from "@workos/authkit-session";

export class StartCookieSessionStorage extends CookieSessionStorage<
  Request,
  Response
> {
  getCookie(request: Request, name: string): Promise<string | null> {
    const value = parseCookieHeader(request.headers.get("cookie") ?? "")[name];
    if (value === undefined) return Promise.resolve(null);
    try {
      return Promise.resolve(decodeURIComponent(value));
    } catch {
      return Promise.resolve(null);
    }
  }
  protected override applyHeaders(
    response: Response | undefined,
    headers: HeadersBag,
  ): Promise<{ response: Response }> {
    const next = cloneResponse(response);
    appendHeaderBag(next.headers, headers);
    return Promise.resolve({ response: next });
  }
}

export function cloneResponse(response: Response | undefined): Response {
  if (response === undefined) return new Response();
  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function appendResponseCookies(
  target: Headers,
  response: Response | undefined,
) {
  for (const cookie of response?.headers.getSetCookie?.() ?? [])
    target.append("Set-Cookie", cookie);
}

export function appendHeaderBag(
  target: Headers,
  headers: HeadersBag | undefined,
) {
  if (!headers) return;
  for (const [key, value] of Object.entries(headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (key.toLowerCase() === "set-cookie") target.append(key, item);
      else target.set(key, item);
    }
  }
}

export function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name) cookies[name] = value.join("=");
  }
  return cookies;
}
