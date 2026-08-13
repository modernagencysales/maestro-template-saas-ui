import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runReviewedGenerator } from "@maestro-template/generators";
import {
  decodeCliRuntimeConfig,
  runCli,
  runCliAsync,
  runRemoteCapability,
} from "./index";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("maestro-template CLI", () => {
  it("accepts the canonical pnpm argument separator", () => {
    const result = runCli(["--", "describe"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ valid: true });
  });

  it("prints the repository modes and supported customer loop", async () => {
    const help = runCli(["help"]).stdout;
    expect(help).toContain("factory checkout: contains releases/");
    expect(help).toContain("generated app: contains template-instance.json");
    expect(help).toContain(
      "preflight -> inspect -> preview -> write -> verify -> run",
    );
    expect(help).toContain("maestro recipes list|show <recipe-id>");
    expect(help).toContain("maestro contracts add <journey>");
    expect(help).toContain("maestro add <outcome-or-recipe>");
    expect(help).toContain("maestro support-bundle");
    expect(help).not.toContain("plan-check");
    expect(help).toContain("maestro mcp\n");
    expect(help).toContain("maestro mcp configure --host <claude-code|codex>");
    await expect(runCliAsync(["scaffold", "--help"])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining(
        "maestro scaffold --generator <id> --args <json-object>",
      ),
    });
  });

  it.each([
    ["workflow", "maestro-template workflow run"],
    ["operations", "maestro-template operations list"],
    ["api", "maestro-template api catalog"],
  ])("prints zero-exit help for %s", (command, usage) => {
    for (const flag of ["--help", "-h"]) {
      expect(runCli([command, flag])).toMatchObject({
        exitCode: 0,
        stdout: expect.stringContaining(usage),
        stderr: "",
      });
    }
  });

  it("keeps CLI scaffold preview bytes identical to the direct generator", async () => {
    const args = {
      name: "cliParity",
      system: "knowledge-brain",
      disposition: "extend",
      exposure: "headless",
    };
    const direct = runReviewedGenerator({
      generatorId: "add-capability",
      args,
      write: false,
      cwd: repoRoot,
    });
    if (!direct.ok) throw new Error(direct.message);
    const cli = await runCliAsync(
      [
        "scaffold",
        "--generator",
        "add-capability",
        "--args",
        JSON.stringify(args),
        "--json",
      ],
      undefined,
      repoRoot,
    );
    expect(cli.exitCode).toBe(0);
    expect(JSON.parse(cli.stdout).data.output.files).toEqual(
      direct.output.files,
    );
  });

  it("preserves legacy commands through the async factory-first entrypoint", async () => {
    const result = await runCliAsync(["describe"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ valid: true });
  });

  it("runs capability requests through the configured app API", async () => {
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const result = await runRemoteCapability(
      [
        "capability",
        "run",
        "records.list",
        "--workspace",
        "template-demo",
        "--input",
        "{}",
        "--idempotency-key",
        "contracts-list-1",
      ],
      {
        MAESTRO_API_BASE_URL: "http://127.0.0.1:3211",
        MAESTRO_API_KEY: "mtk_live_contracts",
      },
      async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response(
          JSON.stringify({
            ok: true,
            operationId: "records.list",
            result: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    expect(result).toEqual({
      exitCode: 0,
      stdout:
        '{\n  "ok": true,\n  "operationId": "records.list",\n  "result": []\n}\n',
      stderr: "",
    });
    expect(observedUrl).toBe("http://127.0.0.1:3211/api/records.list");
    expect(observedInit).toMatchObject({
      method: "POST",
      headers: {
        authorization: "Bearer mtk_live_contracts",
        "content-type": "application/json",
      },
    });
    expect(JSON.parse(String(observedInit?.body))).toEqual({
      workspaceSlug: "template-demo",
      input: {},
      idempotencyKey: "contracts-list-1",
    });
  });

  it("accepts HTTPS capability endpoints", async () => {
    let observedUrl = "";
    const result = await runRemoteCapability(
      [
        "capability",
        "run",
        "records.list",
        "--workspace",
        "template-demo",
        "--input",
        "{}",
        "--idempotency-key",
        "contracts-list-https",
      ],
      {
        MAESTRO_API_BASE_URL: "https://api.example.test/base",
        MAESTRO_API_KEY: "contracts-test-key",
      },
      async (input) => {
        observedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    );

    expect(result?.exitCode).toBe(0);
    expect(observedUrl).toBe("https://api.example.test/base/api/records.list");
  });

  it.each(["http://api.example.test", "http://127.example.test"])(
    "rejects non-loopback HTTP before forwarding the API key: %s",
    async (baseUrl) => {
      const request = vi.fn();
      const result = await runRemoteCapability(
        [
          "capability",
          "run",
          "records.list",
          "--workspace",
          "template-demo",
          "--input",
          "{}",
          "--idempotency-key",
          "contracts-list-unsafe",
        ],
        {
          MAESTRO_API_BASE_URL: baseUrl,
          MAESTRO_API_KEY: "contracts-test-key",
        },
        request,
      );

      expect(result).toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining("HTTPS or loopback HTTP"),
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("does not expose a Vite API proxy that can attach the CLI API key", async () => {
    const config = await vi.importActual<{
      default: { server?: { proxy?: unknown } };
    }>("../../web/vite.config");

    expect(config.default.server).not.toHaveProperty("proxy");
  });

  it("lets TanStack discover generated product routes during builds", () => {
    expect(
      readFileSync(`${repoRoot}/apps/web/vite.config.ts`, "utf8"),
    ).not.toContain("enableRouteGeneration: false");
  });

  it("describes the shared workflow template", () => {
    const result = runCli(["describe"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      valid: true,
      capabilityCount: 8,
      headlessOperationCount: 20,
    });
  });

  it("lists and gets headless operations", () => {
    const list = runCli(["operations", "list"]);
    const operations = JSON.parse(list.stdout);
    const get = runCli(["operations", "get", "api:brain.pages.createMarkdown"]);

    expect(operations).toHaveLength(20);
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).toContain("api:brain.pages.createMarkdown");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).toContain("web:ops.dataLifecycle.createDsarRequest");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).toContain("cli:ops.email.previewBroadcast");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).toContain("mcp:ops.email.dispatchBroadcast");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).not.toContain("api:ops.dataLifecycle.createDsarRequest");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).not.toContain("mcp:ops.dataLifecycle.listDsarRequests");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).not.toContain("web:capabilities.sourceGroundedBrief.runInternal");
    expect(
      operations.map((operation: { id: string }) => operation.id),
    ).not.toContain("CLI:createTrustReceipt");
    expect(JSON.parse(get.stdout)).toMatchObject({
      surface: "api",
      capability: "brain.pages.createMarkdown",
      authScope: "workspace member",
    });
  });

  it("prints API and MCP metadata", () => {
    expect(JSON.parse(runCli(["api", "catalog"]).stdout)).toContainEqual(
      expect.objectContaining({
        operationId: "brain.pages.createMarkdown",
        path: "/api/brain.pages.createMarkdown",
      }),
    );
    expect(JSON.parse(runCli(["api", "catalog"]).stdout)).not.toContainEqual(
      expect.objectContaining({
        operationId: "resolveSourceSet",
      }),
    );
    expect(JSON.parse(runCli(["api", "openapi"]).stdout)).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/api/brain.pages.createMarkdown": {
          post: {
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
                      workspaceSlug: { type: "string" },
                      idempotencyKey: { type: "string" },
                      input: expect.objectContaining({ type: "object" }),
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(JSON.parse(runCli(["mcp", "tools"]).stdout)).toContainEqual(
      expect.objectContaining({
        name: "template.brain.pages.createMarkdown",
        inputSchema: expect.objectContaining({ type: "object" }),
      }),
    );
    expect(JSON.parse(runCli(["mcp", "tools"]).stdout)).toContainEqual(
      expect.objectContaining({
        name: "template.ops.email.dispatchBroadcast",
        inputSchema: expect.objectContaining({
          properties: expect.objectContaining({
            confirmation: { type: "string", enum: ["SEND"] },
          }),
        }),
      }),
    );
    expect(JSON.parse(runCli(["mcp", "tools"]).stdout)).toContainEqual(
      expect.objectContaining({
        name: "template.workflow.run",
        inputSchema: expect.objectContaining({
          type: "object",
          additionalProperties: false,
        }),
      }),
    );
    expect(JSON.parse(runCli(["mcp", "tools"]).stdout)).not.toContainEqual(
      expect.objectContaining({ name: "template.resolveSourceSet" }),
    );
    expect(JSON.parse(runCli(["mcp", "tools"]).stdout)).not.toContainEqual(
      expect.objectContaining({ name: expect.stringContaining("scaffold") }),
    );
  });

  it("calls MCP tools through the shared workflow registry", () => {
    const result = runCli(["mcp", "call", "template.workflow.run"]);
    const call = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(call.isError).toBe(false);
    expect(JSON.parse(call.content[0].text)).toMatchObject({
      runId: "run_template_001",
      workflowRunId: "run_template_001",
      trustReceiptId: "trust_run_template_001",
      trustReceipt: {
        receiptId: "trust_run_template_001",
      },
    });
  });

  it("prints integration readiness without requiring live secrets", () => {
    const report = JSON.parse(
      runCli(["integrations", "report", "fake"]).stdout,
    );

    expect(report).toContainEqual(
      expect.objectContaining({
        id: "workos",
        displayName: "WorkOS/AuthKit",
        mode: "fake",
        ready: true,
      }),
    );
  });

  it("reports live integration readiness from decoded provider env only", () => {
    const config = decodeCliRuntimeConfig({
      WORKOS_API_KEY: "workos_key",
      WORKOS_CLIENT_ID: "workos_client",
      IGNORED_SECRET: "do-not-forward",
    });
    const report = JSON.parse(
      runCli(["integrations", "report", "live"], config).stdout,
    );

    expect(report).toContainEqual(
      expect.objectContaining({
        id: "workos",
        mode: "live",
        ready: true,
      }),
    );
    expect(config.providerEnv).not.toHaveProperty("IGNORED_SECRET");
  });

  it("reports whitespace-contaminated live provider env names without leaking values", () => {
    const config = decodeCliRuntimeConfig({
      WORKOS_API_KEY: " workos_secret ",
      WORKOS_CLIENT_ID: "workos_client",
    });
    const report = JSON.parse(
      runCli(["integrations", "report", "live"], config).stdout,
    );

    expect(report).toContainEqual(
      expect.objectContaining({
        id: "workos",
        mode: "live",
        ready: false,
        missingEnv: [],
        invalidEnv: ["WORKOS_API_KEY"],
      }),
    );
    expect(JSON.stringify(report)).not.toContain("workos_secret");
  });

  it("runs the sample workflow and prints a trust receipt", () => {
    const receipt = JSON.parse(runCli(["workflow", "run"]).stdout);

    expect(receipt).toMatchObject({
      runId: "run_template_001",
      workflowRunId: "run_template_001",
      trustReceiptId: "trust_run_template_001",
      status: "completed",
      trustReceipt: {
        receiptId: "trust_run_template_001",
      },
    });
  });

  it("parses workflow args after the workflow run subcommand", () => {
    expect(
      JSON.parse(
        runCli(["workflow", "run", "--idempotency-key", "workflow-slice"])
          .stdout,
      ),
    ).toMatchObject({
      runId: "run_workflow-slice",
      idempotencyKey: "workflow-slice",
    });
  });

  it("uses workflow run args when provided", () => {
    const receipt = JSON.parse(
      runCli([
        "workflow",
        "run",
        "--workflow",
        "workflow_custom_plan",
        "--workspace",
        "reviewer-brain",
        "--idempotency-key",
        "run-42",
        "--mode",
        "fake",
      ]).stdout,
    );

    expect(receipt).toMatchObject({
      runId: "run_run-42",
      workflowRunId: "run_run-42",
      workflowId: "workflow_custom_plan",
      workspaceSlug: "reviewer-brain",
      mode: "fake",
      trustReceiptId: "trust_run_run-42",
      trustReceipt: {
        receiptId: "trust_run_run-42",
        workflowRunId: "run_run-42",
      },
    });
  });

  it("accepts inline workflow run args", () => {
    const receipt = JSON.parse(
      runCli([
        "workflow",
        "run",
        "--workflow=workflow_inline_plan",
        "--workspace=inline-brain",
        "--idempotency-key=run=43",
        "--mode=",
        '--input={"topic":"inline"}',
      ]).stdout,
    );

    expect(receipt).toMatchObject({
      runId: "run_run=43",
      workflowId: "workflow_inline_plan",
      workspaceSlug: "inline-brain",
      idempotencyKey: "run=43",
      mode: "",
      input: { topic: "inline" },
    });
  });

  it("reports named arg parse errors", () => {
    expect(runCli(["workflow", "run", "--workflow"])).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "--workflow requires a value.\n",
    });
    expect(runCli(["workflow", "run", "--nope"])).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "Unknown option: --nope\n",
    });
    expect(runCli(["workflow", "run", "--input", "[]"])).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "--input must be a JSON object.\n",
    });
  });

  it("requires explicit capability request args", () => {
    expect(runCli(["capability", "run", "brain.pages.createMarkdown"])).toEqual(
      {
        exitCode: 1,
        stdout: "",
        stderr:
          "capability run requires --workspace, --input, and --idempotency-key.\n",
      },
    );
  });

  it("rejects unknown CLI capabilities before parsing request args", () => {
    expect(runCli(["capability", "run", "not.real"])).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "Unknown CLI capability: not.real\n",
    });
  });

  it("runs the source-grounded brief capability from the CLI", () => {
    const result = runCli([
      "capability",
      "run",
      "brain.pages.createMarkdown",
      "--workspace",
      "acme-demo",
      "--input",
      '{"title":"CLI note","markdown":"# CLI note"}',
      "--idempotency-key",
      "brain.pages.createMarkdown-cli-001",
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        _tag: "FeatureDisabled",
        message:
          "Operation brain.pages.createMarkdown requires a runtime execution adapter.",
      },
    });
  });

  it("uses capability request args when provided", () => {
    const result = runCli([
      "capability",
      "run",
      "brain.pages.createMarkdown",
      "--workspace",
      "bad slug",
      "--input",
      '{"title":"Custom note","markdown":"# Custom note"}',
      "--idempotency-key",
      "custom-note-001",
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message: "workspaceSlug must be a lowercase slug.",
      },
    });
  });

  it("parses capability args after the capability id", () => {
    const result = runCli([
      "capability",
      "run",
      "brain.pages.createMarkdown",
      "--workspace",
      "acme-demo",
      "--input",
      '{"title":"Slice check","markdown":"# Slice check"}',
      "--idempotency-key",
      "capability-slice-001",
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        _tag: "FeatureDisabled",
        message:
          "Operation brain.pages.createMarkdown requires a runtime execution adapter.",
      },
    });
  });

  it("returns a clear error for unknown operations", () => {
    const result = runCli(["operations", "get", "cli:nope"]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "Unknown operation: cli:nope\n",
    });
  });
});
