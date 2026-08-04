import { describe, expect, it, vi } from "vitest";

import { runCliAsync } from "./index";

describe("CLI runtime identity", () => {
  it("prints its compiled source SHA and independently authenticated backend identity", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          inputDigest: `sha256:${"a".repeat(64)}`,
          deploymentId: "deployment-one",
          startNonce: "server-start-one",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    const result = await runCliAsync(
      ["identity"],
      {
        providerEnv: {},
        apiBaseUrl: "https://backend.example.test/",
        apiKey: "identity-credential",
      },
      undefined,
      fetch,
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      sourceSha: expect.stringMatching(/^(?:unbuilt|[0-9a-f]{7,64})$/u),
      backend: {
        inputDigest: `sha256:${"a".repeat(64)}`,
        deploymentId: "deployment-one",
        startNonce: "server-start-one",
      },
    });
    expect(fetch).toHaveBeenCalledOnce();
    const request = new Request(...fetch.mock.calls[0]);
    expect(request.url).toBe("https://backend.example.test/identity");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe(
      "Bearer identity-credential",
    );
    expect(await request.text()).toBe("");
  });

  it("accepts no caller-supplied expected identity fields", async () => {
    const fetch = vi.fn();
    const result = await runCliAsync(
      ["identity", "--deployment-id", "forged"],
      {
        providerEnv: {},
        apiBaseUrl: "https://backend.example.test",
        apiKey: "identity-credential",
      },
      undefined,
      fetch,
    );
    expect(result).toMatchObject({
      exitCode: 1,
      stderr: expect.stringMatching(/does not accept arguments/u),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
