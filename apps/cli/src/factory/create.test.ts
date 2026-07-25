import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import { CREATE_HELP, createCreateCliHandler, runCreateCli } from "./create";

function fixture() {
  const execute = vi.fn(async (input: Record<string, unknown>) => ({
    mutationPosture: input.write ? ("write" as const) : ("preview" as const),
    exitClass: "success" as const,
    summary: "captured",
    diagnostics: [],
    data: {
      target: String(input.target),
      name: String(input.name),
      outcome: String(input.outcome),
      demoOnly: input.demoOnly === true,
      write: input.write === true,
    },
  }));
  const command = defineAgentPackCommand({
    id: "create",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (value: unknown) =>
      isRecord(value) && typeof value.target === "string"
        ? { ok: true as const, args: value }
        : {
            ok: false as const,
            diagnostics: [
              {
                code: "INVALID_CREATE_FIXTURE",
                severity: "error" as const,
                message: "invalid",
                safeToContinue: true,
                nextAction: "retry",
                rerun: "pnpm maestro -- create",
              },
            ],
          },
    mutationPosture: (input) => (input.write ? "write" : "preview"),
    execute,
  });
  return { command, execute };
}

const argv = [
  "create",
  "../my-app",
  "--name",
  "My App",
  "--outcome",
  "Track client requests",
];

describe("create CLI adapter", () => {
  it("previews by default and maps the three customer choices", async () => {
    const test = fixture();
    const result = await runCreateCli(
      test.command,
      [...argv, "--demo-only", "--json"],
      "/factory",
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutationPosture: "preview",
      data: {
        target: "../my-app",
        name: "My App",
        outcome: "Track client requests",
        demoOnly: true,
        write: false,
      },
    });
  });

  it("passes write intent only with --write", async () => {
    const test = fixture();
    const result = await runCreateCli(
      test.command,
      [...argv, "--write", "--json"],
      "/factory",
    );
    expect(result.exitCode).toBe(0);
    expect(test.execute).toHaveBeenCalledWith(
      expect.objectContaining({ write: true }),
      expect.anything(),
    );
  });

  it.each(["--provider", "--install", "--git-init", "--production"])(
    "rejects the out-of-scope %s option",
    async (option) => {
      const test = fixture();
      const result = await runCreateCli(
        test.command,
        [...argv, option, "yes", "--json"],
        "/factory",
      );
      expect(result.exitCode).toBe(2);
      expect(test.execute).not.toHaveBeenCalled();
    },
  );

  it("publishes exact leaf help without central registration", async () => {
    const test = fixture();
    const handler = createCreateCliHandler(test.command);
    await expect(
      handler.run(["create", "--help"], "/factory"),
    ).resolves.toEqual(expect.objectContaining({ stdout: CREATE_HELP }));
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
