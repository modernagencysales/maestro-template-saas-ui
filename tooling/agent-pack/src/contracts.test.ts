import { describe, expect, it } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  AGENT_PACK_RESULT_VERSION,
  createAgentPackResult,
  defineAgentPackCommand,
  renderAgentPackResult,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "./contracts.js";
import { AGENT_PACK_EXIT_CODES, type AgentPackExitClass } from "./exitCodes.js";
import { createRepositoryContext } from "./repoContext.js";

const repo = createRepositoryContext({ cwd: "/work/maestro" });
const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo,
};

const finding: AgentPackDiagnostic = {
  code: "AGENT_PACK_EXAMPLE_FINDING",
  severity: "error",
  message: "The example contract needs attention.",
  safeToContinue: false,
  nextAction: "Review the example input.",
  rerun: "pnpm maestro -- example --json",
};

describe("agent-pack command contract", () => {
  it("pins stable versions and exit classes", () => {
    expect(AGENT_PACK_COMMAND_VERSION).toBe(1);
    expect(AGENT_PACK_RESULT_VERSION).toBe(1);
    expect(AGENT_PACK_EXIT_CODES).toEqual({
      success: 0,
      findings: 1,
      invalidInvocation: 2,
      blockedMutation: 3,
      unavailableDependency: 4,
      internalDefect: 70,
    } satisfies Record<AgentPackExitClass, number>);
  });

  it("defines one typed executable used independently of its transport", async () => {
    type Args = { readonly name: string; readonly write: boolean };
    const decode = (input: unknown): AgentPackArgumentResult<Args> =>
      typeof input === "object" && input !== null && "name" in input
        ? {
            ok: true,
            args: {
              name: String(input.name),
              write: "write" in input && input.write === true,
            },
          }
        : { ok: false, diagnostics: [finding] };
    const command = defineAgentPackCommand({
      id: "example",
      schemaVersion: AGENT_PACK_COMMAND_VERSION,
      decode,
      mutationPosture: (args: Args) => (args.write ? "write" : "preview"),
      execute: async (args: Args, executionContext) =>
        createAgentPackResult({
          command: "example",
          mutationPosture: args.write ? "write" : "preview",
          exitClass: "success",
          summary: `Prepared ${args.name}.`,
          context: executionContext,
          diagnostics: [],
          data: { name: args.name },
        }),
    });
    const decoded = command.decode({ name: "demo", write: false });

    expect(decoded).toEqual({
      ok: true,
      args: { name: "demo", write: false },
    });
    if (!decoded.ok) throw new Error("expected decoded args");
    await expect(command.execute(decoded.args, context)).resolves.toMatchObject(
      {
        command: { id: "example", version: 1 },
        mutationPosture: "preview",
        data: { name: "demo" },
      },
    );
  });

  it("creates a stable versioned structured result", () => {
    const result = createAgentPackResult({
      command: "example",
      mutationPosture: "read-only",
      exitClass: "findings",
      summary: "Example inspection found one issue.",
      context,
      diagnostics: [finding],
      data: { inspected: true },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "command": {
          "id": "example",
          "version": 1,
        },
        "context": {
          "invocation": "library",
          "repo": {
            "schemaVersion": 1,
            "sourceRoot": "/work/maestro",
            "targetRoot": "/work/maestro",
            "templateRoot": "/work/maestro",
            "workingDirectory": "/work/maestro",
          },
          "schemaVersion": 1,
        },
        "data": {
          "inspected": true,
        },
        "diagnostics": [
          {
            "code": "AGENT_PACK_EXAMPLE_FINDING",
            "message": "The example contract needs attention.",
            "nextAction": "Review the example input.",
            "rerun": "pnpm maestro -- example --json",
            "safeToContinue": false,
            "severity": "error",
          },
        ],
        "exitClass": "findings",
        "mutationPosture": "read-only",
        "schemaVersion": 1,
        "summary": "Example inspection found one issue.",
      }
    `);
  });

  it("renders concise human output deterministically from the result", () => {
    const result = createAgentPackResult({
      command: "example",
      mutationPosture: "read-only",
      exitClass: "findings",
      summary: "Example inspection found one issue.",
      context,
      diagnostics: [finding],
      data: null,
    });

    expect(renderAgentPackResult(result)).toBe(
      [
        "Example inspection found one issue.",
        "Next: Review the example input.",
        "Rerun: pnpm maestro -- example --json",
        "",
      ].join("\n"),
    );
    expect(renderAgentPackResult(result, { details: true })).toBe(
      [
        "Example inspection found one issue.",
        "Command: example (v1)",
        "Exit: findings (1)",
        "Mutation: read-only",
        "Source root: /work/maestro",
        "Template root: /work/maestro",
        "Target root: /work/maestro",
        "[AGENT_PACK_EXAMPLE_FINDING] The example contract needs attention.",
        "Safe to continue: no",
        "Next: Review the example input.",
        "Rerun: pnpm maestro -- example --json",
        "",
      ].join("\n"),
    );
    expect(renderAgentPackResult(result, { details: true })).toBe(
      renderAgentPackResult(result, { details: true }),
    );
  });
});
