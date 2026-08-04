import { describe, expect, it } from "vitest";
import { executeAuthorizedOperation } from "../confect/capabilities/_kit/authorizedDispatch";

const adapter = {
  refs: { "brain.pages.createMarkdown": "ref" },
  runQuery: async () => ({ ok: true }),
  runMutation: async () => ({ id: "page_123" }),
  runAction: async () => ({ ok: true }),
};

describe("authorized dispatch", () => {
  it("rejects API caller workspace input that differs from verified authority", async () => {
    await expect(
      executeAuthorizedOperation(
        {
          adapter,
          policyFor: () => ({
            id: "auth_api_key_workspace_write",
            credential: "api-key",
            principalKind: "apiKey",
            tenantAuthority: "principal-workspace",
            requiredScopes: ["workspace:write"],
          }),
          authorize: async () => undefined,
        },
        {
          surfaceId: "api.createMarkdown",
          operationId: "brain.pages.createMarkdown",
          principal: {
            kind: "apiKey",
            apiKeyId: "apiKeys_123" as never,
            workspaceId: "workspaces_verified" as never,
            scopes: ["workspace:write"],
            surface: "api",
          },
          input: { workspaceId: "workspaces_unverified" },
          idempotencyKey: "key-123",
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        message: "Caller workspace does not match principal authority.",
      },
    });
  });
});
