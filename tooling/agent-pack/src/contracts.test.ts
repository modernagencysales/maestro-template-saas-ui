import { describe, expect, it } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  AGENT_PACK_RESULT_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
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

const decodeExample = (
  input: unknown,
): AgentPackArgumentResult<{
  readonly name: string;
  readonly write: boolean;
}> =>
  typeof input === "object" && input !== null && "name" in input
    ? {
        ok: true,
        args: {
          name: String(input.name),
          write: "write" in input && input.write === true,
        },
      }
    : { ok: false, diagnostics: [finding] };

const exampleCommand = defineAgentPackCommand({
  id: "example",
  schemaVersion: AGENT_PACK_COMMAND_VERSION,
  decode: decodeExample,
  mutationPosture: (args) => (args.write ? "write" : "preview"),
  execute: async (args) => ({
    mutationPosture: args.write ? "write" : "preview",
    exitClass: "success",
    summary: `Prepared ${args.name}.`,
    diagnostics: [],
    data: { name: args.name },
  }),
});

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
    const decoded = exampleCommand.decode({ name: "demo", write: false });

    expect(decoded).toEqual({
      ok: true,
      args: { name: "demo", write: false },
    });
    if (!decoded.ok) throw new Error("expected decoded args");
    await expect(
      executeAgentPackCommand(
        exampleCommand,
        { name: "demo", write: false },
        context,
      ),
    ).resolves.toMatchObject({
      command: { id: "example", version: 1 },
      mutationPosture: "preview",
      data: { name: "demo" },
    });
  });

  it("always returns a structured invalid-invocation result", async () => {
    let executed = false;
    const command = defineAgentPackCommand({
      ...exampleCommand,
      execute: async (args) => {
        executed = true;
        return exampleCommand.execute(args, context);
      },
    });
    const result = await executeAgentPackCommand(command, {}, context);

    expect(executed).toBe(false);
    expect(result).toMatchObject({
      schemaVersion: 1,
      command: { id: "example", version: 1 },
      mutationPosture: "read-only",
      exitClass: "invalidInvocation",
      context,
      diagnostics: [finding],
      data: null,
    });
  });

  it("rejects a command outcome whose posture differs from its declaration", async () => {
    const command = defineAgentPackCommand({
      ...exampleCommand,
      mutationPosture: () => "preview",
      execute: async () => ({
        mutationPosture: "write",
        exitClass: "success",
        summary: "Incorrectly claimed success.",
        diagnostics: [],
        data: null,
      }),
    });

    await expect(
      executeAgentPackCommand(command, { name: "demo" }, context),
    ).resolves.toMatchObject({
      command: { id: "example", version: 1 },
      mutationPosture: "preview",
      exitClass: "internalDefect",
      diagnostics: [
        expect.objectContaining({
          code: "AGENT_PACK_POSTURE_MISMATCH",
          safeToContinue: false,
        }),
      ],
      data: null,
    });
  });

  it("rejects success paired with an error diagnostic", async () => {
    const command = defineAgentPackCommand({
      ...exampleCommand,
      mutationPosture: () => "read-only",
      execute: async () => ({
        mutationPosture: "read-only",
        exitClass: "success",
        summary: "Incorrectly claimed success.",
        diagnostics: [finding],
        data: null,
      }),
    });

    await expect(
      executeAgentPackCommand(command, { name: "demo" }, context),
    ).resolves.toMatchObject({
      mutationPosture: "read-only",
      exitClass: "internalDefect",
      diagnostics: [
        expect.objectContaining({
          code: "AGENT_PACK_EXIT_DIAGNOSTIC_MISMATCH",
          safeToContinue: false,
        }),
      ],
      data: null,
    });
  });

  it("creates a stable versioned structured result", async () => {
    const command = defineAgentPackCommand({
      ...exampleCommand,
      mutationPosture: () => "read-only",
      execute: async () => ({
        mutationPosture: "read-only",
        exitClass: "findings",
        summary: "Example inspection found one issue.",
        diagnostics: [finding],
        data: { inspected: true },
      }),
    });
    const result = await executeAgentPackCommand(
      command,
      { name: "demo" },
      context,
    );

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

  it("renders concise human output deterministically from the result", async () => {
    const command = defineAgentPackCommand({
      ...exampleCommand,
      mutationPosture: () => "read-only",
      execute: async () => ({
        mutationPosture: "read-only",
        exitClass: "findings",
        summary: "Example inspection found one issue.",
        diagnostics: [finding],
        data: null,
      }),
    });
    const result = await executeAgentPackCommand(
      command,
      { name: "demo" },
      context,
    );

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

  it("renders actionable commands carried by successful command data", async () => {
    const command = defineAgentPackCommand({
      ...exampleCommand,
      execute: async () => ({
        mutationPosture: "preview" as const,
        exitClass: "success" as const,
        summary: "Prepared the next safe step.",
        diagnostics: [],
        data: {
          followUpActions: [{ command: "git init" }],
          confirmationCommand: "pnpm maestro -- add example --write",
          nextCommand: "pnpm maestro -- start --mode fake",
        },
      }),
    });
    const result = await executeAgentPackCommand(
      command,
      { name: "demo" },
      context,
    );

    expect(renderAgentPackResult(result)).toBe(
      [
        "Prepared the next safe step.",
        "Run: git init",
        "Run: pnpm maestro -- add example --write",
        "Run: pnpm maestro -- start --mode fake",
        "",
      ].join("\n"),
    );
  });
});
