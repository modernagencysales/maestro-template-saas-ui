import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "../contracts.js";
import { createProviderDoctorCommand } from "./doctor.js";
import { createConvexDoctorAdapter } from "./convex.js";
import { createRepositoryContext } from "../repoContext.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/customer" }),
};
const canonicalNames = [
  "CONVEX_DEPLOYMENT",
  "CONVEX_DEPLOY_KEY",
  "CONVEX_SITE_URL",
  "VITE_CONVEX_URL",
] as const;
const adapter = (availableEnvironmentNames: readonly string[] = []) =>
  createConvexDoctorAdapter({
    environment: () => ({ availableEnvironmentNames }),
    requiredEnvironmentNames: () => canonicalNames,
    templateProviderReport: () => ({
      status: "pass",
      detail: "convex fake-safe",
    }),
    officialAiFilesFindings: async () => [],
    mcpPolicy: {
      fakeDisabled: true,
      inspectDeployment: "dev",
      productionUnsupported: true,
      alwaysDisabledTools: ["envGet", "envList", "envRemove", "envSet"],
    },
  });
const command = (availableEnvironmentNames: readonly string[] = []) =>
  createProviderDoctorCommand({
    adapters: [adapter(availableEnvironmentNames)],
  });

describe("providers convex doctor", () => {
  it("keeps fake mode an honest working stopping point with no MCP", async () => {
    const result = await executeAgentPackCommand(
      command(),
      { provider: "convex", environment: "fake" },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "read-only",
      exitClass: "success",
      data: {
        provider: "convex",
        environment: "fake",
        ready: true,
        safeStoppingPoint: true,
        missingEnvironmentNames: [],
        invalidEnvironmentNames: [],
        mcp: {
          enabled: false,
          alwaysDisabledTools: ["envGet", "envList", "envRemove", "envSet"],
        },
      },
    });
  });

  it("reports only missing names for personal dev", async () => {
    const result = await executeAgentPackCommand(
      command(["CONVEX_DEPLOYMENT"]),
      { provider: "convex", environment: "dev" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_PROVIDER_ENV_MISSING" }],
      data: {
        ready: false,
        missingEnvironmentNames: ["CONVEX_SITE_URL", "VITE_CONVEX_URL"],
        questions: [expect.objectContaining({ id: "devDeployment" })],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-value|https:\/\/live/i);
  });

  it("isolates live selectors in fake and local without blocking the app", async () => {
    const poisoned = [
      "CONVEX_DEPLOYMENT",
      "CONVEX_DEPLOY_KEY",
      "TEMPLATE_CONVEX_DEPLOY_KEY",
      "VITE_CONVEX_URL",
    ];
    for (const environment of ["fake", "local"] as const) {
      const result = await executeAgentPackCommand(
        command(poisoned),
        { provider: "convex", environment },
        context,
      );
      expect(result).toMatchObject({
        exitClass: "findings",
        data: {
          ready: true,
          invalidEnvironmentNames: poisoned,
        },
      });
      expect(JSON.stringify(result)).not.toContain("secret-value");
    }
  });

  it("refuses production and unknown providers before inspection", async () => {
    const production = await executeAgentPackCommand(
      command(),
      { provider: "convex", environment: "production" },
      context,
    );
    const unknown = await executeAgentPackCommand(
      command(),
      { provider: "invented", environment: "dev" },
      context,
    );
    expect(production).toMatchObject({ exitClass: "invalidInvocation" });
    expect(unknown).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_PROVIDER_UNKNOWN" }],
    });
  });

  it("reports official ai-files drift without inventing installation success", async () => {
    const convex = createConvexDoctorAdapter({
      environment: () => ({ availableEnvironmentNames: [] }),
      requiredEnvironmentNames: () => canonicalNames,
      templateProviderReport: () => ({ status: "pass", detail: "fake-safe" }),
      officialAiFilesFindings: async () => [
        "missing:.agents/skills/convex/SKILL.md",
      ],
      mcpPolicy: {
        fakeDisabled: true,
        inspectDeployment: "dev",
        productionUnsupported: true,
        alwaysDisabledTools: ["envGet", "envList", "envRemove", "envSet"],
      },
    });
    const result = await executeAgentPackCommand(
      createProviderDoctorCommand({ adapters: [convex] }),
      { provider: "convex", environment: "fake" },
      context,
    );
    expect(result).toMatchObject({
      exitClass: "success",
      data: {
        aiFiles: {
          status: "recommended",
          findings: [expect.stringContaining("missing:")],
        },
      },
    });
  });
});
