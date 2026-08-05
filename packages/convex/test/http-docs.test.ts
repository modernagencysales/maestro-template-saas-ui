import { describe, expect, it } from "vitest";
import templateHttp from "../confect/http";
import { createEmailUnsubscribeToken } from "../confect/email/unsubscribeToken";
import { buildGeneratedMcpTools } from "../confect/manifest/mcp";
import {
  type HeadlessHttpCtx,
  handleTemplateHttpRequest,
  securityHeaders,
  templateHttpRoutes,
} from "../src/index";

const readJson = async (response: Response): Promise<unknown> =>
  JSON.parse(await response.text());

const noopCtx: HeadlessHttpCtx = {
  runQuery: async () => {
    throw new Error("runQuery should not be called");
  },
  runMutation: async () => {
    throw new Error("runMutation should not be called");
  },
  runAction: async () => {
    throw new Error("runAction should not be called");
  },
};

describe("template HTTP docs routes", () => {
  it("default-exports a Convex router covering every declared route", () => {
    const byPathThenMethod = (
      a: { path: string; method: string },
      b: { path: string; method: string },
    ) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
    const routes = templateHttp
      .getRoutes()
      .map(([path, method]) => ({ path, method }))
      .sort(byPathThenMethod);

    expect(routes).toEqual(
      [
        ...templateHttpRoutes.map(({ path, method }) => ({ path, method })),
        { path: "/deploy-authority/consume", method: "POST" },
      ].sort(byPathThenMethod),
    );
  });

  it("declares OpenAPI, Scalar docs, and executable API routes", () => {
    expect(templateHttpRoutes).toEqual(
      expect.arrayContaining([
        {
          path: "/api/openapi.json",
          method: "GET",
          description: "Serves the generated OpenAPI 3.1 document.",
        },
        {
          path: "/api/docs",
          method: "GET",
          description: "Serves the Scalar API documentation shell.",
        },
        {
          path: "/api/brain.pages.createMarkdown",
          method: "POST",
          description: "Executes brain.pages.createMarkdown.",
        },
      ]),
    );
  });

  it("forwards the untouched Dodo body and signature headers to the webhook action", async () => {
    const calls: unknown[] = [];
    const rawBody =
      '{"type":"payment.succeeded","data":{"payment_id":"pay_1"}}';
    const response = await handleTemplateHttpRequest(
      {
        ...noopCtx,
        runAction: async (ref, input) => {
          calls.push({ ref, input });
          return { eventId: "evt_1", status: "processed" };
        },
      },
      new Request("https://template.local/webhooks/dodo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "webhook-id": "evt_1",
          "webhook-signature": "v1,signature",
          "webhook-timestamp": "1700000000",
        },
        body: rawBody,
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      expect.objectContaining({
        input: {
          rawBody,
          webhookId: "evt_1",
          signature: "v1,signature",
          signatureTimestamp: "1700000000",
        },
      }),
    ]);
  });

  it("authenticates and normalizes Postmark webhooks before mutation", async () => {
    const previousUsername = process.env.POSTMARK_WEBHOOK_USERNAME;
    const previousPassword = process.env.POSTMARK_WEBHOOK_PASSWORD;
    process.env.POSTMARK_WEBHOOK_USERNAME = "postmark";
    process.env.POSTMARK_WEBHOOK_PASSWORD = "webhook-secret";
    try {
      const calls: unknown[] = [];
      const ctx: HeadlessHttpCtx = {
        ...noopCtx,
        runMutation: async (ref, input) => {
          calls.push({ ref, input });
          return { status: "processed", suppressed: true };
        },
      };
      const unauthorized = await handleTemplateHttpRequest(
        ctx,
        new Request("https://template.local/webhooks/email/postmark", {
          method: "POST",
          body: JSON.stringify({ RecordType: "Bounce" }),
        }),
      );
      expect(unauthorized.status).toBe(401);
      expect(calls).toHaveLength(0);

      const response = await handleTemplateHttpRequest(
        ctx,
        new Request("https://template.local/webhooks/email/postmark", {
          method: "POST",
          headers: {
            authorization: `Basic ${btoa("postmark:webhook-secret")}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            RecordType: "Bounce",
            Type: "HardBounce",
            Email: "Person@Example.com",
            MessageID: "message-1",
            BouncedAt: "2026-08-02T12:00:00Z",
            Description: "raw provider detail must not be forwarded",
          }),
        }),
      );
      expect(response.status).toBe(200);
      expect(calls).toEqual([
        expect.objectContaining({
          input: {
            fingerprint: expect.any(String),
            kind: "hard_bounce",
            recipient: "person@example.com",
            providerMessageId: "message-1",
          },
        }),
      ]);
      expect(JSON.stringify(calls)).not.toContain("raw provider detail");
    } finally {
      if (previousUsername === undefined)
        delete process.env.POSTMARK_WEBHOOK_USERNAME;
      else process.env.POSTMARK_WEBHOOK_USERNAME = previousUsername;
      if (previousPassword === undefined)
        delete process.env.POSTMARK_WEBHOOK_PASSWORD;
      else process.env.POSTMARK_WEBHOOK_PASSWORD = previousPassword;
    }
  });

  it("shows a signed unsubscribe confirmation and mutates only on POST", async () => {
    const previousSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-fixture";
    try {
      const token = await createEmailUnsubscribeToken({
        subscriberId: "emailSubscribers_123",
        secret: process.env.EMAIL_UNSUBSCRIBE_SECRET,
      });
      const calls: unknown[] = [];
      const ctx: HeadlessHttpCtx = {
        ...noopCtx,
        runMutation: async (ref, input) => {
          calls.push({ ref, input });
          return { status: "unsubscribed" };
        },
      };
      const confirmation = await handleTemplateHttpRequest(
        ctx,
        new Request(
          `https://template.local/email/unsubscribe?token=${encodeURIComponent(token)}`,
        ),
      );
      expect(confirmation.status).toBe(200);
      expect(await confirmation.text()).toContain("Stop marketing emails?");
      expect(confirmation.headers.get("content-security-policy")).toContain(
        "form-action 'self'",
      );
      expect(calls).toHaveLength(0);

      const applied = await handleTemplateHttpRequest(
        ctx,
        new Request("https://template.local/email/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
        }),
      );
      expect(applied.status).toBe(200);
      expect(await applied.text()).toContain("You are unsubscribed.");
      expect(calls).toEqual([
        expect.objectContaining({
          input: { subscriberId: "emailSubscribers_123" },
        }),
      ]);
    } finally {
      if (previousSecret === undefined)
        delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
      else process.env.EMAIL_UNSUBSCRIBE_SECRET = previousSecret;
    }
  });

  it("serves generated OpenAPI JSON", async () => {
    const response = await handleTemplateHttpRequest(
      noopCtx,
      new Request("https://template.local/api/openapi.json"),
    );
    const body = await readJson(response);

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/api/brain.pages.createMarkdown": {
          post: {
            operationId: "brain.pages.createMarkdown",
            tags: ["template-headless"],
            "x-maestro-auth-scope": "workspace member",
            "x-maestro-typed-errors": [
              "Unauthorized",
              "MemberNotInWorkspace",
              "WorkspaceNotFound",
              "ValidationFailed",
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["input", "idempotencyKey"],
                    properties: {
                      input: {
                        type: "object",
                        required: ["workspaceId", "slug", "title", "markdown"],
                      },
                      idempotencyKey: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Typed operation result." },
              "400": { description: "Declared typed failure." },
            },
          },
        },
      },
    });
  });

  it("serves MCP tools with generated Effect JSON schemas", () => {
    const createMarkdownTool = buildGeneratedMcpTools().find(
      (tool) => tool.name === "template.brain.pages.createMarkdown",
    );

    expect(createMarkdownTool?.inputSchema).toMatchObject({
      type: "object",
      required: ["workspaceId", "slug", "title", "markdown"],
      properties: {
        workspaceId: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string" },
      },
    });
    expect(createMarkdownTool?.inputSchema).not.toEqual({
      type: "object",
      additionalProperties: true,
    });
  });

  it("applies security headers to every HTTP response", async () => {
    const responses = await Promise.all([
      handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/docs"),
      ),
      handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/openapi.json"),
      ),
      handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/missing"),
      ),
    ]);

    for (const response of responses) {
      expect(response.headers.get("strict-transport-security")).toBe(
        securityHeaders["strict-transport-security"],
      );
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
    }
  });

  it("serves a Scalar docs shell", async () => {
    const response = await handleTemplateHttpRequest(
      noopCtx,
      new Request("https://template.local/api/docs"),
    );
    const html = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("@scalar/api-reference");
    expect(html).toContain('data-url="/api/openapi.json"');
  });

  it("executes a generated API operation through the Convex adapter runner", async () => {
    const calls: unknown[] = [];
    const ctx: HeadlessHttpCtx = {
      ...noopCtx,
      runMutation: async (ref, input) => {
        calls.push([ref, input]);
        return { id: "brainPage_123", source: "adapter-runner" };
      },
    };
    const response = await handleTemplateHttpRequest(
      ctx,
      new Request("https://template.local/api/brain.pages.createMarkdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "acme-demo",
          input: { slug: "a-note", title: "A note", markdown: "# A note" },
          idempotencyKey: "brain-page-example-001",
        }),
      }),
    );
    const body = await readJson(response);

    expect(body).toMatchObject({
      ok: true,
      operationId: "brain.pages.createMarkdown",
      result: {
        id: "brainPage_123",
        source: "adapter-runner",
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject([
      expect.anything(),
      {
        workspaceId: "workspace_123",
        slug: "a-note",
        title: "A note",
        markdown: "# A note",
        idempotencyKey: "brain-page-example-001",
      },
    ]);
  });

  it("requires a bearer API key for records operations", async () => {
    const response = await handleTemplateHttpRequest(
      noopCtx,
      new Request("https://template.local/api/records.list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceSlug: "template-demo", input: {} }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({
      ok: false,
      error: {
        _tag: "Unauthorized",
        code: "API_KEY_MISSING",
        message: "Missing bearer API key.",
      },
    });
  });

  it("resolves a records actor before dispatching the operation", async () => {
    const calls: Array<{ readonly input: Record<string, unknown> }> = [];
    const response = await handleTemplateHttpRequest(
      {
        ...noopCtx,
        runQuery: async (_ref, input) => {
          calls.push({ input });
          return "keyHash" in input
            ? {
                ok: true,
                keyId: "api_key_contracts",
                workspaceId: "workspace_contracts",
                userId: "user_contracts",
              }
            : [
                {
                  _id: "record_contracts",
                  workspaceId: "workspace_contracts",
                  title: "Launch checklist",
                  detail: "Created from the app",
                  createdAt: 1,
                  updatedAt: 1,
                },
              ];
        },
      },
      new Request("https://template.local/api/records.list", {
        method: "POST",
        headers: {
          authorization: "Bearer mtk_live_contracts",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceSlug: "template-demo",
          input: {},
          idempotencyKey: "contracts-list-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      ok: true,
      operationId: "records.list",
      result: [{ title: "Launch checklist" }],
    });
    expect(calls).toEqual([
      {
        input: {
          keyHash: expect.any(String),
          workspaceSlug: "template-demo",
          requiredScope: "workspace:read",
          nowMs: expect.any(Number),
        },
      },
      {
        input: {
          workspaceId: "workspace_contracts",
          userId: "user_contracts",
        },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain("mtk_live_contracts");
  });

  it("rejects a key bound to another workspace before records dispatch", async () => {
    let queryCount = 0;
    const response = await handleTemplateHttpRequest(
      {
        ...noopCtx,
        runQuery: async () => {
          queryCount += 1;
          return {
            ok: false,
            code: "API_KEY_WORKSPACE_MISMATCH",
            message: "API key is bound to a different workspace.",
          };
        },
      },
      new Request("https://template.local/api/records.list", {
        method: "POST",
        headers: {
          authorization: "Bearer mtk_live_contracts",
          "content-type": "application/json",
        },
        body: JSON.stringify({ workspaceSlug: "another-workspace", input: {} }),
      }),
    );

    expect(response.status).toBe(403);
    expect(queryCount).toBe(1);
    expect(await readJson(response)).toEqual({
      ok: false,
      error: {
        _tag: "Forbidden",
        code: "API_KEY_WORKSPACE_MISMATCH",
        message: "API key is bound to a different workspace.",
      },
    });
  });

  it("executes the documented OpenAPI request envelope", async () => {
    const calls: unknown[] = [];
    const ctx: HeadlessHttpCtx = {
      ...noopCtx,
      runMutation: async (ref, input) => {
        calls.push([ref, input]);
        return { id: "brainPage_456", source: "openapi-envelope" };
      },
    };
    const response = await handleTemplateHttpRequest(
      ctx,
      new Request("https://template.local/api/brain.pages.createMarkdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            workspaceId: "workspace_openapi",
            slug: "openapi-note",
            title: "OpenAPI note",
            markdown: "# OpenAPI note",
          },
          idempotencyKey: "openapi-envelope-001",
        }),
      }),
    );

    expect(await readJson(response)).toMatchObject({
      ok: true,
      operationId: "brain.pages.createMarkdown",
      result: {
        id: "brainPage_456",
        source: "openapi-envelope",
      },
    });
    expect(calls[0]).toMatchObject([
      expect.anything(),
      {
        workspaceId: "workspace_openapi",
        slug: "openapi-note",
        title: "OpenAPI note",
        markdown: "# OpenAPI note",
        idempotencyKey: "openapi-envelope-001",
      },
    ]);
  });

  it("fails closed when generated API request fields cannot be mapped", async () => {
    const body = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/brain.pages.createMarkdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceSlug: "unknown-workspace",
            input: { slug: "a-note", title: "A note", markdown: "# A note" },
            idempotencyKey: "brain-page-example-001",
          }),
        }),
      ),
    );

    expect(body).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires input.workspaceId or a known workspaceSlug.",
      },
    });
  });

  it("returns typed validation errors for malformed JSON requests", async () => {
    const body = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/brain.pages.createMarkdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      ),
    );

    expect(body).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message: "Request body must be valid JSON.",
      },
    });
  });

  it("returns typed validation errors for generated API operations", async () => {
    const body = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/brain.pages.createMarkdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceSlug: "acme-demo",
            input: {},
          }),
        }),
      ),
    );

    expect(body).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires a nonblank idempotencyKey.",
      },
    });
  });

  it("returns typed validation errors for non-string API envelope fields", async () => {
    const invalidIdempotencyKey = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/brain.pages.createMarkdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceSlug: "acme-demo",
            input: { slug: "a-note", title: "A note", markdown: "# A note" },
            idempotencyKey: 42,
          }),
        }),
      ),
    );
    const invalidWorkspaceSlug = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/brain.pages.createMarkdown", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceSlug: true,
            input: { slug: "a-note", title: "A note", markdown: "# A note" },
            idempotencyKey: "brain-page-example-001",
          }),
        }),
      ),
    );

    expect(invalidIdempotencyKey).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires a nonblank idempotencyKey.",
      },
    });
    expect(invalidWorkspaceSlug).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires input.workspaceId or a known workspaceSlug.",
      },
    });
  });

  it("returns typed route errors for invalid HTTP requests", async () => {
    const method = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/api/docs", { method: "POST" }),
      ),
    );
    const missing = await readJson(
      await handleTemplateHttpRequest(
        noopCtx,
        new Request("https://template.local/nope"),
      ),
    );

    expect(method).toEqual({
      ok: false,
      error: {
        _tag: "MethodNotAllowed",
        message: "Only GET is supported for Scalar docs.",
      },
    });
    expect(missing).toEqual({
      ok: false,
      error: {
        _tag: "NotFound",
        message: "Unknown template HTTP route: /nope",
      },
    });
  });
});
