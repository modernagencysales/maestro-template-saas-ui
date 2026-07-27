import { describe, expect, it, vi } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  createScaffoldCommand,
  type ScaffoldDependencies,
  type ScaffoldGeneratorOutput,
} from "./scaffold.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/repo" }),
};
const args = {
  name: "sourceBrief",
  system: "knowledge-brain",
  disposition: "extend",
};
const output: ScaffoldGeneratorOutput = {
  files: [{ path: "generated/sourceBrief.ts", content: "export {};\n" }],
  provenancePaths: [
    "docs/template/generated/provenance/add-capability/sourceBrief.json",
  ],
  collisions: [],
  semanticRuleIds: ["WF-DEFINE"],
  manualFollowUp: ["Review the generated capability contract."],
  codegen: ["pnpm confect:codegen", "pnpm confect:manifest"],
  focusedGates: ["pnpm check:confect-contracts"],
};

function dependencies(
  overrides: Partial<ScaffoldDependencies> = {},
): ScaffoldDependencies {
  return {
    generators: {
      resolve: () => ({ supported: true }),
      run: async () => ({ ok: true, output }),
    },
    preflight: {
      inspect: async () => ({
        fingerprint: "preflight_sha256:current",
        safeToMutate: true,
        cleanWorktree: true,
      }),
    },
    workflow: { semantics: [], reviewedAdrRefs: () => new Set() },
    ...overrides,
  };
}

describe("scaffold command", () => {
  it("previews by default and preserves generator bytes", async () => {
    const run = vi.fn(async () => ({ ok: true as const, output }));
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: { resolve: () => ({ supported: true }), run },
        }),
      ),
      { generatorId: "add-capability", args },
      context,
    );

    expect(run).toHaveBeenCalledWith({
      generatorId: "add-capability",
      args,
      write: false,
      repo: context.repo,
    });
    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: { mode: "preview", output },
    });
    expect(result.data?.output?.files[0]?.content).toBe(
      output.files[0]?.content,
    );
  });

  it("writes only after a passing matching preflight fingerprint", async () => {
    const events: string[] = [];
    const run = vi.fn(async (request) => {
      events.push(request.write ? "write" : "preview");
      return { ok: true as const, output };
    });
    const inspect = vi.fn(async () => {
      events.push("preflight");
      return {
        fingerprint: "preflight_sha256:current",
        safeToMutate: true,
        cleanWorktree: true,
      };
    });
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: { resolve: () => ({ supported: true }), run },
          preflight: { inspect },
        }),
      ),
      {
        generatorId: "add-capability",
        args,
        write: true,
        preflightFingerprint: "preflight_sha256:current",
      },
      context,
    );

    expect(events).toEqual(["preview", "preflight", "write"]);
    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { mode: "write", output },
    });
  });

  it.each([
    ["missing", undefined, true],
    ["changed", "preflight_sha256:stale", true],
    ["blocking", "preflight_sha256:current", false],
  ] as const)(
    "blocks a %s preflight fingerprint before writing",
    async (_case, fingerprint, safeToMutate) => {
      const run = vi.fn(async () => ({ ok: true as const, output }));
      const result = await executeAgentPackCommand(
        createScaffoldCommand(
          dependencies({
            generators: { resolve: () => ({ supported: true }), run },
            preflight: {
              inspect: async () => ({
                fingerprint: "preflight_sha256:current",
                safeToMutate,
                cleanWorktree: true,
              }),
            },
          }),
        ),
        {
          generatorId: "add-capability",
          args,
          write: true,
          ...(fingerprint === undefined
            ? {}
            : { preflightFingerprint: fingerprint }),
        },
        context,
      );

      expect(run).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        exitClass: "blockedMutation",
        diagnostics: [{ code: "AGENT_PACK_SCAFFOLD_PREFLIGHT_STALE" }],
      });
    },
  );

  it("refuses a dirty worktree even when preview paths do not overlap", async () => {
    const run = vi.fn(async () => ({ ok: true as const, output }));
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: { resolve: () => ({ supported: true }), run },
          preflight: {
            inspect: async () => ({
              fingerprint: "preflight_sha256:current",
              safeToMutate: true,
              cleanWorktree: false,
            }),
          },
        }),
      ),
      {
        generatorId: "add-capability",
        args,
        write: true,
        preflightFingerprint: "preflight_sha256:current",
      },
      context,
    );

    expect(output.collisions).toEqual([]);
    expect(run).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_SCAFFOLD_WORKTREE_DIRTY" }],
    });
  });

  it("refuses previewed collisions before writing", async () => {
    const collided = { ...output, collisions: ["generated/sourceBrief.ts"] };
    const run = vi.fn(async () => ({ ok: true as const, output: collided }));
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: { resolve: () => ({ supported: true }), run },
        }),
      ),
      {
        generatorId: "add-capability",
        args,
        write: true,
        preflightFingerprint: "preflight_sha256:current",
      },
      context,
    );

    expect(run).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_SCAFFOLD_COLLISION" }],
      data: { output: collided },
    });
  });

  it("returns reviewed alternatives and a template-gap skeleton", async () => {
    const nearest = [
      {
        generatorId: "add-feature",
        recipe: "docs/template/how-to-add-feature.md",
        command: "pnpm template:add-feature",
      },
    ];
    const run = vi.fn();
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: {
            resolve: () => ({ supported: false, nearest }),
            run,
          },
        }),
      ),
      { generatorId: "add-dashboard-widget", args },
      context,
    );

    expect(run).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      exitClass: "findings",
      diagnostics: [{ code: "AGENT_PACK_SCAFFOLD_UNSUPPORTED" }],
      data: {
        nearest,
        templateGap: {
          kind: "template-gap",
          target: "add-dashboard-widget",
          templateBacklogRef: "<required-reviewed-template-backlog-ref>",
          templateResolutionPath: "<required-promotion-or-import-path>",
        },
      },
    });
  });

  const restrictedRule = {
    id: "WF-STEP-ACTION",
    status: "intentionally-restricted" as const,
    repair:
      "Use a mutation/query capability or wait for the Phase 1 action strategy compiler.",
  };
  const reviewedAdr =
    "docs/template/adr/0002-maestro-graph-over-convex-workflow.md";

  it.each([
    [
      "declared alternative",
      {
        kind: "declared-alternative" as const,
        ruleId: restrictedRule.id,
        alternative: restrictedRule.repair,
      },
    ],
    [
      "reviewed ADR",
      {
        kind: "reviewed-adr" as const,
        ruleId: restrictedRule.id,
        adrRef: reviewedAdr,
      },
    ],
  ])("allows a restricted primitive with its %s", async (_case, resolution) => {
    const run = vi.fn(async () => ({ ok: true as const, output }));
    const result = await executeAgentPackCommand(
      createScaffoldCommand(
        dependencies({
          generators: { resolve: () => ({ supported: true }), run },
          workflow: {
            semantics: [restrictedRule],
            reviewedAdrRefs: () => new Set([reviewedAdr]),
          },
        }),
      ),
      {
        generatorId: "add-workflow",
        args,
        workflowRuleIds: ["WF-STEP-ACTION"],
        workflowResolutions: [resolution],
      },
      context,
    );

    expect(run).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      exitClass: "success",
      data: { restrictions: [] },
    });
  });

  it.each([
    ["missing", []],
    [
      "invalid alternative",
      [
        {
          kind: "declared-alternative" as const,
          ruleId: restrictedRule.id,
          alternative: "Use an unreviewed action wrapper.",
        },
      ],
    ],
    [
      "invalid ADR",
      [
        {
          kind: "reviewed-adr" as const,
          ruleId: restrictedRule.id,
          adrRef: "docs/template/adr/9999-missing.md",
        },
      ],
    ],
  ])(
    "blocks a restricted primitive with %s resolution",
    async (_case, workflowResolutions) => {
      const run = vi.fn();
      const result = await executeAgentPackCommand(
        createScaffoldCommand(
          dependencies({
            generators: { resolve: () => ({ supported: true }), run },
            workflow: {
              semantics: [restrictedRule],
              reviewedAdrRefs: () => new Set([reviewedAdr]),
            },
          }),
        ),
        {
          generatorId: "add-workflow",
          args,
          workflowRuleIds: [restrictedRule.id],
          workflowResolutions,
        },
        context,
      );

      expect(run).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        exitClass: "blockedMutation",
        diagnostics: [{ code: "AGENT_PACK_WORKFLOW_PRIMITIVE_RESTRICTED" }],
      });
    },
  );
});
