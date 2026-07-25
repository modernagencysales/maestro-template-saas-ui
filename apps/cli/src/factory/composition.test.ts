import { diagnosticRegistryDescriptors } from "@maestro-template/quality-tooling";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { describe, expect, it } from "vitest";
import { createRepositoryContext } from "@maestro-template/agent-pack";
import {
  FACTORY_EXECUTION_POLICY,
  createFactoryCliComposition,
  projectCompositionEnvironment,
} from "./composition";

const factoryCliComposition = createFactoryCliComposition(() => ({}));

describe("factory CLI composition", () => {
  it("binds one explicit policy to canonical readers and seven commands", () => {
    expect(
      factoryCliComposition.handlers.map(({ command }) => command),
    ).toEqual([
      "create",
      "start",
      "preflight",
      "verify",
      "check",
      "plan-check",
      "scaffold",
    ]);
    expect(factoryCliComposition.diagnosticCount).toBe(
      diagnosticRegistryDescriptors.length,
    );
    expect(factoryCliComposition.workflowRuleCount).toBe(
      WORKFLOW_SEMANTICS.length,
    );
    expect(FACTORY_EXECUTION_POLICY).toMatchObject({
      supportedPlatforms: ["linux", "darwin", "win32"],
      supportedNodeMajors: [22],
      requiredPorts: [],
      packageJsonMaxBytes: 256 * 1024,
    });
  });

  it("imports generator and quality sources without running either CLI", () => {
    expect(process.exitCode).toBeUndefined();
    expect(factoryCliComposition.handlers).toHaveLength(7);
  });

  it("routes exact start help without spawning", async () => {
    const start = factoryCliComposition.handlers.find(
      ({ command }) => command === "start",
    );
    await expect(
      start?.run(["start", "--help"], "/tmp/customer-app"),
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout:
        "maestro start [--mode fake|local|dev] [--human|--details|--json]\n",
      stderr: "",
    });
  });

  it("projects repository-aware environment names without values", () => {
    const environment = projectCompositionEnvironment(
      createRepositoryContext({ cwd: "/tmp/customer-app" }),
      () => ({
        BUILDKITE: "true",
        OPENROUTER_API_KEY: "fake",
        EMPTY: "",
      }),
    );

    expect(environment).toMatchObject({
      sourceRoot: "/tmp/customer-app",
      targetRoot: "/tmp/customer-app",
      ci: true,
      availableEnvironmentNames: "BUILDKITE,OPENROUTER_API_KEY",
    });
    expect(JSON.stringify(environment)).not.toContain("fake");
  });
});
