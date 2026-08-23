import { describe, expect, it } from "vitest";
import {
  buildApiCatalog,
  buildGeneratedMcpTools,
  buildHeadlessOperations,
  buildMcpTools,
  buildOpenApiDocument,
  callMcpTool,
  describeWorkflowTemplate,
  generatedMcpOperationRefs,
  getHeadlessOperation,
  runTemplateApiOperation,
  runTemplateWorkflow,
} from "./index";

describe("workflow headless registry", () => {
  it("projects every manifest function to its declared surfaces", () => {
    const operations = buildHeadlessOperations();
    const ids = operations.map((operation) => operation.id);

    expect(operations).toHaveLength(22);
    expect(ids).toContain("api:brain.pages.createMarkdown");
    expect(ids).toContain("cli:brain.pages.createMarkdown");
    expect(ids).toContain("web:brain.pages.list");
    expect(ids).toContain("web:brain.pages.updateMarkdown");
    expect(ids).toContain("web:ops.dataLifecycle.createDsarRequest");
    expect(ids).toContain("web:ops.dataLifecycle.listDsarRequests");
    expect(ids).toContain("api:ops.email.previewBroadcast");
    expect(ids).toContain("mcp:ops.email.dispatchBroadcast");
    expect(ids).not.toContain("api:ops.dataLifecycle.createDsarRequest");
    expect(ids).not.toContain("mcp:ops.dataLifecycle.listDsarRequests");
    expect(ids).not.toContain(
      "web:capabilities.sourceGroundedBrief.runInternal",
    );
    expect(ids).not.toContain("CLI:createTrustReceipt");
    expect(ids).not.toContain("api:resolveSourceSet");
    expect(
      operations.every((operation) => operation.typedErrors.length > 0),
    ).toBe(true);
  });

  it("describes the template workflow with validation status", () => {
    expect(describeWorkflowTemplate()).toEqual({
      valid: true,
      validationErrors: [],
      nodeCount: 5,
      edgeCount: 4,
      capabilityCount: 10,
      agentCount: 3,
      headlessOperationCount: 22,
    });
  });

  it("looks up a single operation by stable id", () => {
    expect(
      getHeadlessOperation("api:brain.pages.createMarkdown"),
    ).toMatchObject({
      surface: "api",
      capability: "brain.pages.createMarkdown",
      authScope: "workspace member",
    });
    expect(getHeadlessOperation("CLI:createTrustReceipt")).toBeUndefined();
  });

  it("projects API and MCP metadata from the generated manifest", () => {
    expect(buildApiCatalog()).toEqual([
      {
        operationId: "brain.pages.createMarkdown",
        method: "POST",
        path: "/api/brain.pages.createMarkdown",
        authScope: "workspace member",
        typedErrors: [
          "Unauthorized",
          "MemberNotInWorkspace",
          "WorkspaceNotFound",
          "ValidationFailed",
        ],
      },
      {
        operationId: "ops.email.dispatchBroadcast",
        method: "POST",
        path: "/api/ops.email.dispatchBroadcast",
        authScope: "workspace member",
        typedErrors: [
          "Unauthorized",
          "Forbidden",
          "MemberNotInWorkspace",
          "WorkspaceNotFound",
          "ValidationFailed",
        ],
      },
      {
        operationId: "ops.email.previewBroadcast",
        method: "POST",
        path: "/api/ops.email.previewBroadcast",
        authScope: "workspace member",
        typedErrors: [
          "Unauthorized",
          "Forbidden",
          "MemberNotInWorkspace",
          "WorkspaceNotFound",
          "ValidationFailed",
        ],
      },
    ]);

    expect(buildMcpTools()).toContainEqual({
      name: "template.brain.pages.createMarkdown",
      description:
        "Invoke brain.pages.createMarkdown through the generated Confect contract manifest.",
      inputSchema: expect.objectContaining({
        type: "object",
        required: ["workspaceId", "slug", "title", "markdown"],
        properties: expect.objectContaining({
          workspaceId: { type: "string" },
          slug: { type: "string" },
          title: { type: "string" },
          markdown: { type: "string" },
        }),
      }),
      typedErrors: [
        "Unauthorized",
        "MemberNotInWorkspace",
        "WorkspaceNotFound",
        "ValidationFailed",
      ],
    });
    expect(buildGeneratedMcpTools()).not.toContainEqual(
      expect.objectContaining({ name: "template.workflow.run" }),
    );
    expect(buildApiCatalog()).not.toContainEqual(
      expect.objectContaining({
        operationId: "ops.dataLifecycle.createDsarRequest",
      }),
    );
    expect(buildGeneratedMcpTools()).not.toContainEqual(
      expect.objectContaining({
        name: "template.ops.dataLifecycle.listDsarRequests",
      }),
    );
    expect(buildMcpTools()).toContainEqual({
      name: "template.workflow.run",
      description: "Run the template workflow compatibility adapter.",
      inputSchema: expect.objectContaining({
        type: "object",
        additionalProperties: false,
      }),
      typedErrors: [],
    });
    expect(buildMcpTools()).not.toContainEqual(
      expect.objectContaining({ name: "template.resolveSourceSet" }),
    );
  });

  it("builds an OpenAPI document from the shared API catalog", () => {
    const document = buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths)).toEqual([
      "/api/brain.pages.createMarkdown",
      "/api/ops.email.dispatchBroadcast",
      "/api/ops.email.previewBroadcast",
    ]);
    expect(
      document.paths["/api/brain.pages.createMarkdown"]?.post,
    ).toMatchObject({
      operationId: "brain.pages.createMarkdown",
      "x-maestro-auth-scope": "workspace member",
      "x-maestro-typed-errors": expect.arrayContaining([
        "Unauthorized",
        "MemberNotInWorkspace",
        "WorkspaceNotFound",
        "ValidationFailed",
      ]),
    });
    const createMarkdown =
      document.paths["/api/brain.pages.createMarkdown"]?.post;

    expect(createMarkdown).toMatchObject({
      operationId: "brain.pages.createMarkdown",
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
                input: expect.objectContaining({
                  type: "object",
                  required: ["workspaceId", "slug", "title", "markdown"],
                }),
                idempotencyKey: { type: "string" },
              },
            },
          },
        },
      },
    });

    if (!createMarkdown) {
      throw new Error(
        "brain.pages.createMarkdown OpenAPI operation is missing",
      );
    }

    expect(createMarkdown.responses["200"]).toEqual({
      description: "Typed operation result.",
    });
    expect(createMarkdown.responses["400"]).toEqual({
      description: "Declared typed failure.",
    });
  });

  it("returns a deterministic run receipt for the template workflow", () => {
    expect(runTemplateWorkflow()).toMatchObject({
      runId: "run_template_001",
      workflowRunId: "run_template_001",
      workflowId: "workflow_source_grounded_plan",
      workflowName: "Source-grounded planning workflow",
      status: "completed",
      trustReceiptId: "trust_run_template_001",
      trustReceipt: {
        receiptId: "trust_run_template_001",
      },
    });
  });

  it("does not execute manifest API operations without a runtime adapter", () => {
    expect(
      runTemplateApiOperation("brain.pages.createMarkdown", {
        workspaceSlug: "acme-demo",
        input: { title: "A note", markdown: "# A note" },
        idempotencyKey: "receipt-example-001",
      }),
    ).toEqual({
      ok: false,
      error: {
        _tag: "FeatureDisabled",
        message:
          "Operation brain.pages.createMarkdown requires a runtime execution adapter.",
      },
    });
  });

  it("executes manifest operations through an explicit runtime adapter", () => {
    expect(
      runTemplateApiOperation(
        "brain.pages.createMarkdown",
        {
          workspaceSlug: "acme-demo",
          input: { title: "A note", markdown: "# A note" },
          idempotencyKey: "receipt-example-001",
        },
        undefined,
        {
          runGeneratedOperation: (request) => ({
            ok: true,
            operationId: request.operationId,
            result: {
              ref: request.operationId,
              surface: request.surface,
              workspaceSlug: request.workspaceSlug,
              idempotencyKey: request.idempotencyKey,
            },
          }),
        },
      ),
    ).toEqual({
      ok: true,
      operationId: "brain.pages.createMarkdown",
      result: {
        ref: "brain.pages.createMarkdown",
        surface: "cli",
        workspaceSlug: "acme-demo",
        idempotencyKey: "receipt-example-001",
      },
    });
  });

  it("returns typed API errors for unknown operations and invalid requests", () => {
    expect(runTemplateApiOperation("nope")).toEqual({
      ok: false,
      error: {
        _tag: "NotFound",
        message: "Unknown template API operation: nope",
      },
    });

    expect(
      runTemplateApiOperation("brain.pages.createMarkdown", {
        workspaceSlug: "bad slug",
        idempotencyKey: "receipt-example-001",
      }),
    ).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message: "workspaceSlug must be a lowercase slug.",
      },
    });

    expect(
      runTemplateApiOperation("brain.pages.createMarkdown", {
        workspaceSlug: "acme-demo",
      }),
    ).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires a nonblank idempotencyKey.",
      },
    });
  });

  it("invokes MCP compatibility tools from the generated manifest", () => {
    const capabilityResult = callMcpTool("template.brain.pages.createMarkdown");
    const workflowResult = callMcpTool("template.workflow.run");

    expect(capabilityResult.isError).toBe(false);
    expect(JSON.parse(capabilityResult.content[0]?.text ?? "{}")).toMatchObject(
      {
        ok: false,
        capability: "brain.pages.createMarkdown",
        error: {
          _tag: "FeatureDisabled",
        },
      },
    );
    expect(JSON.parse(workflowResult.content[0]?.text ?? "{}")).toMatchObject({
      runId: "run_template_001",
      workflowRunId: "run_template_001",
      trustReceiptId: "trust_run_template_001",
      trustReceipt: {
        receiptId: "trust_run_template_001",
      },
    });
  });

  it("round-trips the fallback name of every listed generated MCP tool", () => {
    const refs = generatedMcpOperationRefs as Record<string, string>;
    const operationId = "brain.pages.createMarkdown";
    const configured = refs[operationId];
    delete refs[operationId];
    try {
      const listed = buildGeneratedMcpTools().find((tool) =>
        tool.description.includes(operationId),
      );
      expect(listed?.name).toBe(`template.${operationId}`);
      expect(callMcpTool(listed?.name ?? "").isError).toBe(false);
    } finally {
      if (configured !== undefined) refs[operationId] = configured;
    }
  });

  it("executes MCP manifest operations through an explicit runtime adapter", () => {
    const capabilityResult = callMcpTool(
      "template.brain.pages.createMarkdown",
      undefined,
      {
        runGeneratedOperation: (request) => ({
          ok: true,
          operationId: request.operationId,
          result: {
            ref: request.operationId,
            surface: request.surface,
            workspaceSlug: request.workspaceSlug,
          },
        }),
      },
      {
        workspaceSlug: "acme-demo",
        input: { title: "MCP note", markdown: "# MCP note" },
        idempotencyKey: "mcp-example-001",
        surface: "cli",
      },
    );

    expect(capabilityResult.isError).toBe(false);
    expect(JSON.parse(capabilityResult.content[0]?.text ?? "{}")).toEqual({
      ok: true,
      operationId: "brain.pages.createMarkdown",
      result: {
        ref: "brain.pages.createMarkdown",
        surface: "mcp",
        workspaceSlug: "acme-demo",
      },
    });
  });

  it("returns a structured MCP error for unknown tools", () => {
    const result = callMcpTool("template.nope");

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toEqual({
      ok: false,
      error: {
        _tag: "ToolNotFound",
        message: "Unknown MCP tool: template.nope",
      },
    });
  });
});
