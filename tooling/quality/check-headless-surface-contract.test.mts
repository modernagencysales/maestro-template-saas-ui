import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import {
  cannedRegistryImport,
  cannedRegistryImportFailures,
  descriptor,
  missingExternalValidationError,
  missingCliGeneratedRefUsage,
  missingGeneratedRefMapping,
  missingHttpExecutorDispatch,
  missingHttpGeneratedRefMapping,
  internalNamedOperationsWithClientSurfaces,
  missingMcpGeneratedRefUsage,
  missingRuntimeAdapterDispatch,
  missingTypedErrors,
  mcpProjectionPath,
  optionalRuntimeSource,
} from "./check-headless-surface-contract.mts";

describe("check:headless-surface-contract", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("does not pin the removed canned runtime source proof", () => {
    expect(
      descriptor.requirements.flatMap(({ includes }) => includes),
    ).not.toContain("cannedRuntimeSuccess");
  });

  it("reports exposed manifest operations without typed errors", () => {
    expect(
      missingTypedErrors([
        { operationId: "x", surfaces: ["api"], typedErrors: [] },
      ]),
    ).toContain("x");

    expect(
      missingTypedErrors([
        { operationId: "internal.x", surfaces: ["internal"], typedErrors: [] },
        { operationId: "web.x", surfaces: ["web"], typedErrors: [] },
        {
          operationId: "api.x",
          surfaces: ["api"],
          typedErrors: ["ValidationFailed"],
        },
      ]),
    ).toEqual([]);
  });

  it("requires external surfaces to declare validation failures", () => {
    expect(
      missingExternalValidationError([
        {
          operationId: "api.x",
          surfaces: ["api"],
          typedErrors: ["Unauthorized"],
        },
      ]),
    ).toEqual(["api.x"]);

    expect(
      missingExternalValidationError([
        {
          operationId: "api.x",
          surfaces: ["api"],
          typedErrors: ["Unauthorized", "ValidationFailed"],
        },
        {
          operationId: "web.x",
          surfaces: ["web"],
          typedErrors: ["Unauthorized"],
        },
      ]),
    ).toEqual([]);
  });

  it("rejects internal-named operations exposed to client-callable surfaces", () => {
    expect(
      internalNamedOperationsWithClientSurfaces([
        {
          operationId: "capabilities.sourceGroundedBrief.runInternal",
          surfaces: ["web", "workflow", "internal"],
          typedErrors: ["ValidationFailed"],
        },
      ]),
    ).toEqual(["capabilities.sourceGroundedBrief.runInternal"]);

    expect(
      internalNamedOperationsWithClientSurfaces([
        {
          operationId: "capabilities.sourceGroundedBrief.runInternal",
          surfaces: ["workflow", "internal"],
          typedErrors: ["ValidationFailed"],
        },
        {
          operationId: "capabilities.sourceGroundedBrief.run",
          surfaces: ["web", "workflow", "internal"],
          typedErrors: ["ValidationFailed"],
        },
      ]),
    ).toEqual([]);
  });

  it("reports forbidden registry imports on generated surfaces", () => {
    expect(
      cannedRegistryImport(
        'import { templateRegistry } from "@maestro-template/template-core";',
      ),
    ).toContain("templateRegistry");

    expect(
      cannedRegistryImport(
        'import { confectManifest } from "@maestro-template/template-core/generated/confectManifest";',
      ),
    ).toEqual([]);
  });

  it("reports forbidden registry imports in workflow compatibility runtime code", () => {
    expect(
      cannedRegistryImportFailures([
        {
          path: "tooling/workflow/src/workflow-compat.ts",
          source:
            'import { templateRegistry } from "@maestro-template/template-core";',
        },
      ]),
    ).toEqual([
      "tooling/workflow/src/workflow-compat.ts imports forbidden canned registry templateRegistry",
    ]);
  });

  it("omits workflow-only runtime sources from neutral customer checks", () => {
    expect(mcpProjectionPath(false)).toBe("apps/cli/src/headlessRegistry.ts");
    expect(mcpProjectionPath(true)).toBe("tooling/workflow/src/index.ts");
    expect(
      optionalRuntimeSource(
        "tooling/workflow/src/workflow-compat.ts",
        undefined,
      ),
    ).toEqual([]);
    expect(
      optionalRuntimeSource(
        "tooling/workflow/src/workflow-compat.ts",
        "export const workflowCompatibility = true;",
      ),
    ).toEqual([
      {
        path: "tooling/workflow/src/workflow-compat.ts",
        source: "export const workflowCompatibility = true;",
      },
    ]);
  });

  it("reports missing generated ref mappings", () => {
    expect(
      missingGeneratedRefMapping(["brain.pages.createMarkdown"], "{}"),
    ).toContain("brain.pages.createMarkdown");

    expect(
      missingGeneratedRefMapping(
        ["brain.pages.createMarkdown"],
        '{"brain.pages.createMarkdown": api.brain.pages.createMarkdown}',
      ),
    ).toEqual([]);
  });

  it("rejects API operation IDs that appear only in routes or help text", () => {
    const routeOnlySource = `
      const templateHttpRoutes = [{
        path: "/api/brain.pages.createMarkdown",
        description: "Executes brain.pages.createMarkdown.",
      }];
    `;

    expect(
      missingHttpGeneratedRefMapping(
        ["brain.pages.createMarkdown"],
        routeOnlySource,
      ),
    ).toContain("brain.pages.createMarkdown");
    expect(missingHttpExecutorDispatch(routeOnlySource)).toBe(true);
  });

  it("accepts API mappings only when operationRefs feed the executor", () => {
    const source = `
      const operationRefs = {
        "brain.pages.createMarkdown": api.brain.pages.createMarkdown,
      };

      return executeHeadlessOperation(
        { refs: operationRefs, runMutation },
        executorRequest.request,
      );
    `;

    expect(
      missingHttpGeneratedRefMapping(["brain.pages.createMarkdown"], source),
    ).toEqual([]);
    expect(missingHttpExecutorDispatch(source)).toBe(false);
  });

  it("accepts API operation IDs mapped to a differently named generated ref", () => {
    const source = `
      const operationRefs = {
        "changesignal.overview.get": api.capabilities.changeFeed.getOverview,
      };
    `;

    expect(
      missingHttpGeneratedRefMapping(["changesignal.overview.get"], source),
    ).toEqual([]);
  });

  it("requires CLI and MCP projections to use a runtime adapter seam", () => {
    expect(
      missingRuntimeAdapterDispatch(
        "return { ok: false, error: { _tag: 'FeatureDisabled' } };",
      ),
    ).toBe(true);

    expect(
      missingRuntimeAdapterDispatch(`
        export type TemplateRuntimeAdapter = {
          runGeneratedOperation: () => ({ ok: true });
        };
        return runtime.runGeneratedOperation(request);
      `),
    ).toBe(false);
  });

  it("rejects API mappings with regex-compatible but wrong operation IDs", () => {
    const source = `
      const operationRefs = {
        "brain-pages-createMarkdown": api.brain.pages.createMarkdown,
      };
    `;

    expect(
      missingHttpGeneratedRefMapping(["brain.pages.createMarkdown"], source),
    ).toContain("brain.pages.createMarkdown");
  });

  it("rejects inert CLI mapping constants", () => {
    const unusedMappingSource = `
      export const staticCliOperationRefs = {
        "brain.pages.createMarkdown": "brain.pages.createMarkdown",
      };

      const help = "maestro-template capability run brain.pages.createMarkdown";
      return runTemplateApiOperation(maybeId, {});
    `;

    expect(
      missingCliGeneratedRefUsage(
        ["brain.pages.createMarkdown"],
        unusedMappingSource,
      ),
    ).toContain("brain.pages.createMarkdown");
  });

  it("accepts CLI mappings only when dispatch resolves through them", () => {
    const source = `
      export const staticCliOperationRefs = {
        "brain.pages.createMarkdown": "brain.pages.createMarkdown",
      };

      const operationId = staticCliOperationRefs[maybeId];
      return runTemplateApiOperation(operationId, {});
    `;

    expect(
      missingCliGeneratedRefUsage(["brain.pages.createMarkdown"], source),
    ).toEqual([]);
  });

  it("accepts a shared CLI ref helper with different operation and ref names", () => {
    const source = `
      export const staticCliOperationRefs = {
        "changesignal.overview.get": "capabilities.changeFeed.getOverview",
      };

      const operationRef = refFor(staticCliOperationRefs, maybeId);
      return runTemplateApiOperation(operationRef, {});
    `;

    expect(
      missingCliGeneratedRefUsage(["changesignal.overview.get"], source),
    ).toEqual([]);
  });

  it("rejects CLI mappings with regex-compatible but wrong operation IDs", () => {
    const source = `
      export const staticCliOperationRefs = {
        "brain-pages-createMarkdown": "brain.pages.createMarkdown",
      };

      const operationId = staticCliOperationRefs[maybeId];
      return runTemplateApiOperation(operationId, {});
    `;

    expect(
      missingCliGeneratedRefUsage(["brain.pages.createMarkdown"], source),
    ).toContain("brain.pages.createMarkdown");
  });

  it("requires MCP mappings for both tool listing and call dispatch", () => {
    const unusedMappingSource = `
      export const generatedMcpOperationRefs = {
        "brain.pages.createMarkdown": "template.brain.pages.createMarkdown",
      };

      const tools = entries.map((entry) => ({
        name: \`template.\${entry.operationId}\`,
      }));
      const operation = entries.find(
        (candidate) => \`template.\${candidate.operationId}\` === toolName,
      );
    `;

    expect(
      missingMcpGeneratedRefUsage(
        ["brain.pages.createMarkdown"],
        unusedMappingSource,
      ),
    ).toContain("brain.pages.createMarkdown");
  });

  it("accepts MCP mappings only when listing and dispatch use them", () => {
    const source = `
      export const generatedMcpOperationRefs = {
        "brain.pages.createMarkdown": "template.brain.pages.createMarkdown",
      };

      const tools = entries.map((entry) => ({
        name: generatedMcpOperationRefs[entry.operationId],
      }));
      const operation = entries.find(
        (candidate) => generatedMcpOperationRefs[candidate.operationId] === toolName,
      );
    `;

    expect(
      missingMcpGeneratedRefUsage(["brain.pages.createMarkdown"], source),
    ).toEqual([]);
  });

  it("accepts one shared MCP naming helper for explicit and fallback refs", () => {
    const source = `
      export const generatedMcpOperationRefs = {
        "brain.pages.createMarkdown": "template.brain.pages.createMarkdown",
      };
      const mcpToolNameFor = (operationId) =>
        generatedMcpOperationRefs[operationId] ?? \`template.\${operationId}\`;

      const tools = entries.map((entry) => ({
        name: mcpToolNameFor(entry.operationId),
      }));
      const operation = entries.find(
        (candidate) => mcpToolNameFor(candidate.operationId) === toolName,
      );
    `;

    expect(
      missingMcpGeneratedRefUsage(
        ["brain.pages.createMarkdown", "changesignal.overview.get"],
        source,
      ),
    ).toEqual([]);
  });

  it("rejects MCP mappings with regex-compatible but wrong operation IDs", () => {
    const source = `
      export const generatedMcpOperationRefs = {
        "brain-pages-createMarkdown": "template.brain.pages.createMarkdown",
      };

      const tools = entries.map((entry) => ({
        name: generatedMcpOperationRefs[entry.operationId],
      }));
      const operation = entries.find(
        (candidate) => generatedMcpOperationRefs[candidate.operationId] === toolName,
      );
    `;

    expect(
      missingMcpGeneratedRefUsage(["brain.pages.createMarkdown"], source),
    ).toContain("brain.pages.createMarkdown");
  });
});
