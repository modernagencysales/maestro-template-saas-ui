import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
} from "../contracts.js";
import { createMaestroMcpProjection } from "../mcp/projection.js";
import { createProviderDoctorCommand } from "../providers/doctor.js";
import { createConvexDoctorAdapter } from "../providers/convex.js";
import { createRepositoryContext } from "../repoContext.js";
import { createSupportBundlePreview } from "./supportBundle.js";

const secretCanary = ["provider", "secret", "canary"].join("-");
const payloadCanary = ["raw", "provider", "payload"].join("-");
const repo = createRepositoryContext({ cwd: "/privacy-fixture" });
const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "library" as const,
  repo,
};

describe("privacy boundary canaries", () => {
  it("does not echo forbidden MCP secret or payload fields", async () => {
    const execute = vi.fn(async () => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: "fixture",
      diagnostics: [],
      data: { ok: true },
    }));
    const command = (
      id: "preflight" | "scaffold" | "support-bundle" | "verify",
    ) =>
      defineAgentPackCommand({
        id,
        schemaVersion: AGENT_PACK_COMMAND_VERSION,
        decode: (input: unknown) => ({ ok: true as const, args: input }),
        mutationPosture: () =>
          id === "scaffold" || id === "support-bundle"
            ? ("preview" as const)
            : ("read-only" as const),
        execute,
      });
    const projection = createMaestroMcpProjection(
      {
        preflight: command("preflight"),
        scaffold: command("scaffold"),
        supportBundle: command("support-bundle"),
        verify: command("verify"),
      },
      repo,
    );
    const result = await projection.call("maestro_preflight", {
      apiKey: secretCanary,
      payload: payloadCanary,
    });

    expect(result).toMatchObject({
      isError: true,
      code: "MCP_FORBIDDEN_ARGUMENT",
    });
    expect(JSON.stringify(result)).not.toContain(secretCanary);
    expect(JSON.stringify(result)).not.toContain(payloadCanary);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects caller-built support registries and diagnostic text canaries", () => {
    const registry = { codes: new Set([secretCanary]) };
    const source = {
      host: { kind: "unknown" },
      providers: [],
      registry,
      diagnostics: [
        {
          code: secretCanary,
          message: secretCanary,
          nextAction: payloadCanary,
        },
      ],
    };

    expect(() => createSupportBundlePreview(source)).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
  });

  it("keeps provider environment values behind the names-only adapter", async () => {
    const environment = {
      CONVEX_DEPLOYMENT: secretCanary,
      VITE_CONVEX_URL: payloadCanary,
    };
    const adapter = createConvexDoctorAdapter({
      environment: () => ({
        availableEnvironmentNames: Object.keys(environment),
      }),
      requiredEnvironmentNames: () => [
        "CONVEX_DEPLOYMENT",
        "CONVEX_SITE_URL",
        "VITE_CONVEX_URL",
      ],
      templateProviderReport: () => ({ status: "pass", detail: "fake-safe" }),
      officialAiFilesFindings: async () => [],
      mcpPolicy: {
        fakeDisabled: true,
        inspectDeployment: "dev",
        productionUnsupported: true,
        alwaysDisabledTools: ["envGet", "envList", "envRemove", "envSet"],
      },
    });
    const result = await executeAgentPackCommand(
      createProviderDoctorCommand({ adapters: [adapter] }),
      { provider: "convex", environment: "dev" },
      context,
    );

    expect(JSON.stringify(result)).not.toContain(secretCanary);
    expect(JSON.stringify(result)).not.toContain(payloadCanary);
    expect(result.data).toMatchObject({
      missingEnvironmentNames: ["CONVEX_SITE_URL"],
    });
  });
});
