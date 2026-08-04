import { describe, expect, it } from "vitest";

import {
  createRuntimeIdentity,
  readRuntimeIdentity,
} from "../confect/runtime/identity";
import { handleTemplateHttpRequest } from "../confect/http";

describe("runtime identity", () => {
  it("keeps the server-created start identity stable and rejects caller fields", () => {
    const identity = createRuntimeIdentity({
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}`,
      randomUUID: () => "server-start-one",
    });

    expect(readRuntimeIdentity(identity, {})).toEqual({
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}`,
      startNonce: "server-start-one",
    });
    expect(() =>
      readRuntimeIdentity(identity, { deploymentId: "forged" }),
    ).toThrow(/does not accept caller identity/u);
  });

  it("serves the stored identity only after independent API-key authentication", async () => {
    const identity = createRuntimeIdentity({
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}`,
      randomUUID: () => "server-start-one",
    });
    const policies: string[] = [];
    const response = await handleTemplateHttpRequest(
      {
        authenticate: async ({ policy }) => {
          policies.push(policy.id);
          return {
            kind: "apiKey",
            apiKeyId: "api_key_one" as never,
            workspaceId: "workspace_one" as never,
            scopes: ["workspace:read"],
            surface: "api",
          };
        },
        readRuntimeIdentity: async () => identity,
        runQuery: async () => undefined,
        runMutation: async () => undefined,
        runAction: async () => undefined,
      },
      new Request("https://candidate.example/identity", {
        headers: { authorization: "Bearer mtk_live_test" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(identity);
    expect(policies).toEqual(["auth_api_key_workspace_read"]);
  });
});
