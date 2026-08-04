import { describe, expect, it } from "vitest";
import { createHttpCapabilityRunner } from "./httpCapabilityClient";

describe("HTTP capability client", () => {
  it("maps structured HTTP failures without leaking credentials", async () => {
    for (const [status, tag, message] of [
      [401, "Unauthorized", "Capability request unauthorized.\n"],
      [403, "Forbidden", "Capability request forbidden.\n"],
      [404, "NotFound", "CLI capability route not found.\n"],
      [422, "ValidationFailed", "Capability request validation failed.\n"],
    ] as const) {
      const runner = createHttpCapabilityRunner({
        config: {
          providerEnv: {},
          apiBaseUrl: "https://api.example.test/",
          apiKey: "mtk_live_do-not-leak",
        },
        fetch: async () =>
          new Response(JSON.stringify({ ok: false, error: { _tag: tag } }), {
            status,
            headers: { "content-type": "application/json" },
          }),
      });

      const result = await runner("brain.pages.createMarkdown", {
        workspaceSlug: "acme-demo",
        input: {},
        idempotencyKey: "cli-failure-001",
      });

      expect(result).toEqual({ exitCode: 1, stdout: "", stderr: message });
      expect(JSON.stringify(result)).not.toContain("mtk_live_do-not-leak");
    }
  });
});
