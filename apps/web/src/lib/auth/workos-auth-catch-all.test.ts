import { describe, expect, it } from "vitest";

import { workosAuthCatchAllRouteOptions } from "./workos-auth-catch-all";

describe("WorkOS catch-all route adapter", () => {
  it("rejects non-logout POST requests", async () => {
    const response = await workosAuthCatchAllRouteOptions.server.handlers.POST({
      request: new Request("https://app.example/api/auth/session", {
        method: "POST",
        headers: { Origin: "https://app.example" },
      }),
    } as never);

    expect(response.status).toBe(403);
  });
});
