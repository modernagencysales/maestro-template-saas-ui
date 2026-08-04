import { describe, expect, it } from "vitest";

import { executeAuthorizedOperation } from "../confect/capabilities/_kit/authorizedDispatch";
import type { Principal } from "../confect/capabilities/_kit/principal";

const surfaces = [
  {
    id: "brain_pages_create_web",
    transport: "ui",
    coverageTag: "@covers_brain_pages_create_web",
    authPolicyId: "auth_session_membership_editor",
    authority: {
      kind: "convex-function",
      registrationLocator: "brain.pages.createMarkdown",
    },
  },
  {
    id: "brain_pages_create_api",
    transport: "api",
    coverageTag: "@covers_brain_pages_create_api",
    authPolicyId: "auth_api_key_workspace_write",
    authority: {
      kind: "convex-function",
      registrationLocator: "brain.pages.createMarkdown",
    },
  },
] as const;

const userPrincipal = {
  kind: "user",
  userId: "users_123" as never,
  subject: "same-subject",
  surface: "web",
} as const;

const apiPrincipal = {
  kind: "apiKey",
  apiKeyId: "apiKeys_123" as never,
  workspaceId: "workspaces_verified" as never,
  scopes: ["workspace:write"],
  surface: "api",
} as const;

const request = (principal: typeof userPrincipal | typeof apiPrincipal) => ({
  surfaceId:
    principal.kind === "user"
      ? "brain_pages_create_web"
      : "brain_pages_create_api",
  operationId: "brain.pages.createMarkdown",
  principal,
  input: { workspaceId: "workspaces_verified" },
  idempotencyKey: "key-123",
});

describe("authorized dispatch", () => {
  it("authenticates, admits, authorizes, then runs the handler", async () => {
    const calls: string[] = [];

    const result = await executeAuthorizedOperation(
      {
        surfaces,
        journeys: {},
        emergencyDenied: false,
        adapter: {
          refs: { "brain.pages.createMarkdown": "ref" },
          runQuery: async () => ({ ok: true }),
          runMutation: async () => {
            calls.push("handler");
            return { id: "page_123" };
          },
          runAction: async () => ({ ok: true }),
        },
        authenticate: async () => {
          calls.push("authenticate");
          return apiPrincipal;
        },
        authorize: async () => {
          calls.push("authorize");
        },
      },
      request(apiPrincipal),
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["authenticate", "authorize", "handler"]);
  });

  it("records controller-installed evidence only after an admitted handler succeeds", async () => {
    const calls: string[] = [];
    const result = await executeAuthorizedOperation(
      {
        surfaces,
        journeys: {},
        emergencyDenied: false,
        adapter: {
          refs: { "brain.pages.createMarkdown": "ref" },
          runQuery: async () => undefined,
          runMutation: async () => {
            calls.push("handler");
            return { id: "page_123" };
          },
          runAction: async () => undefined,
        },
        authenticate: async () => apiPrincipal,
        authorize: async () => undefined,
        acceptanceEvidence: {
          runtimeMarker: "epoch-one",
          scenarioNonce: "scenario-one",
          backend: {
            deploymentId: "deployment-one",
            inputDigest: `sha256:${"a".repeat(64)}`,
            startNonce: "server-start-one",
          },
          principalDigest: async () => `sha256:${"b".repeat(64)}`,
          store: {
            runtimeMarker: "epoch-one",
            append: async (row) => {
              calls.push(`evidence:${row.correlationNonce}`);
            },
            drain: async () => [],
          },
        },
      },
      { ...request(apiPrincipal), correlationNonce: "step-one" },
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["handler", "evidence:step-one"]);
  });

  it("binds the generated surface to its operation and transport", async () => {
    const handler = async () => {
      throw new Error("handler should not run");
    };
    const context = {
      surfaces,
      journeys: {},
      emergencyDenied: false,
      adapter: {
        refs: { "brain.pages.createMarkdown": "ref" },
        runQuery: handler,
        runMutation: handler,
        runAction: handler,
      },
      authenticate: async (principal: Principal) => principal,
      authorize: async () => undefined,
    };

    await expect(
      executeAuthorizedOperation(context, {
        ...request(apiPrincipal),
        operationId: "ops.email.dispatchBroadcast",
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      executeAuthorizedOperation(context, {
        ...request(apiPrincipal),
        surfaceId: "brain_pages_create_web",
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("stops emergency-denied surfaces before authorization and handler", async () => {
    const calls: string[] = [];

    await expect(
      executeAuthorizedOperation(
        {
          surfaces,
          journeys: {},
          emergencyDenied: true,
          adapter: {
            refs: { "brain.pages.createMarkdown": "ref" },
            runQuery: async () => undefined,
            runMutation: async () => calls.push("handler"),
            runAction: async () => undefined,
          },
          authenticate: async () => {
            calls.push("authenticate");
            return apiPrincipal;
          },
          authorize: async () => {
            calls.push("authorize");
          },
        },
        request(apiPrincipal),
      ),
    ).rejects.toThrow(/emergency denied/u);
    expect(calls).toEqual(["authenticate"]);
  });

  it("routes valid session and API-key principals to the same implementation", async () => {
    const calls: unknown[] = [];
    const context = {
      surfaces,
      journeys: {},
      emergencyDenied: false,
      adapter: {
        refs: { "brain.pages.createMarkdown": "shared-ref" },
        runQuery: async () => undefined,
        runMutation: async (ref: unknown, input: unknown) => {
          calls.push([ref, input]);
          return "page_123";
        },
        runAction: async () => undefined,
      },
      authenticate: async (principal: Principal) => principal,
      authorize: async () => undefined,
    };

    await executeAuthorizedOperation(context, request(userPrincipal));
    await executeAuthorizedOperation(context, request(apiPrincipal));

    expect(calls).toEqual([
      [
        "shared-ref",
        { workspaceId: "workspaces_verified", idempotencyKey: "key-123" },
      ],
      [
        "shared-ref",
        { workspaceId: "workspaces_verified", idempotencyKey: "key-123" },
      ],
    ]);
  });

  it("rejects tenant selectors that differ from verified API authority", async () => {
    await expect(
      executeAuthorizedOperation(
        {
          surfaces,
          journeys: {},
          emergencyDenied: false,
          adapter: {
            refs: { "brain.pages.createMarkdown": "ref" },
            runQuery: async () => ({ ok: true }),
            runMutation: async () => ({ id: "page_123" }),
            runAction: async () => ({ ok: true }),
          },
          authenticate: async () => apiPrincipal,
          authorize: async () => undefined,
        },
        {
          ...request(apiPrincipal),
          input: { workspaceId: "workspaces_unverified" },
        },
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        message: "Caller workspace does not match principal authority.",
      },
    });
  });

  it("uses the authenticated principal instead of the caller claim", async () => {
    const forgedPrincipal = {
      ...apiPrincipal,
      workspaceId: "workspaces_forged" as never,
    };
    const authorized: unknown[] = [];

    await expect(
      executeAuthorizedOperation(
        {
          surfaces,
          journeys: {},
          emergencyDenied: false,
          adapter: {
            refs: { "brain.pages.createMarkdown": "ref" },
            runQuery: async () => undefined,
            runMutation: async () => "page_123",
            runAction: async () => undefined,
          },
          authenticate: async () => apiPrincipal,
          authorize: async (principal) => {
            authorized.push(principal);
          },
        },
        request(forgedPrincipal),
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(authorized).toEqual([apiPrincipal]);
  });
});
