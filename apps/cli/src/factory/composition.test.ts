import { diagnosticRegistryDescriptors } from "@maestro-template/quality-tooling";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { describe, expect, it } from "vitest";
import { FACTORY_EXECUTION_POLICY, factoryCliComposition } from "./composition";

describe("factory CLI composition", () => {
  it("binds one explicit policy to canonical readers and three commands", () => {
    expect(
      factoryCliComposition.handlers.map(({ command }) => command),
    ).toEqual(["preflight", "verify", "check"]);
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
    expect(factoryCliComposition.handlers).toHaveLength(3);
  });
});
