import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import { CREATE_HELP, createCreateCliHandler, runCreateCli } from "./create";

function fixture() {
  const writes = Array.from({ length: 2_000 }, (_, index) => ({
    path: `generated/path-${index}.ts`,
    bytes: index + 1,
  }));
  const omissions = Array.from(
    { length: 1_000 },
    (_, index) => `omitted/path-${index}.md`,
  );
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
      release: {
        ownershipManifest: "releases/v0.2.0-alpha.1/manifest.json",
        ownershipManifestChecksum: `sha256:${"c".repeat(64)}`,
      },
      preview: {
        preflightFingerprint: `preflight_sha256:${"d".repeat(64)}`,
        writes,
        omissions,
        collisions: ["occupied/package.json"],
        totalBytes: writes.reduce((total, write) => total + write.bytes, 0),
      },
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
    const receipt = JSON.parse(result.stdout);
    expect(result.stdout.length).toBeLessThan(5_000);
    expect(receipt).toMatchObject({
      mutationPosture: "preview",
      data: {
        target: "../my-app",
        name: "My App",
        outcome: "Track client requests",
        demoOnly: true,
        write: false,
        preview: {
          preflightFingerprint: `preflight_sha256:${"d".repeat(64)}`,
          writeCount: 2_000,
          omissionCount: 1_000,
          collisionCount: 1,
          collisions: ["occupied/package.json"],
          totalBytes: 2_001_000,
          fullInventory: {
            manifest: "releases/v0.2.0-alpha.1/manifest.json",
            manifestChecksum: `sha256:${"c".repeat(64)}`,
            renderWith: "--details",
          },
        },
      },
    });
    expect(receipt.data.preview).not.toHaveProperty("writes");
    expect(receipt.data.preview).not.toHaveProperty("omissions");
  });

  it("keeps the complete create inventory behind explicit details", async () => {
    const test = fixture();
    const result = await runCreateCli(
      test.command,
      [...argv, "--demo-only", "--details"],
      "/factory",
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"path": "generated/path-1999.ts"');
    expect(result.stdout).toContain('"omitted/path-999.md"');
  });

  it("passes write intent with --write alone", async () => {
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

  it("accepts the canonical separator at the tagged-candidate boundary", async () => {
    const test = fixture();
    const handler = createCreateCliHandler(test.command);
    const result = await handler.run(["--", ...argv, "--json"], "/factory");

    expect(result.exitCode).toBe(0);
    expect(test.execute).toHaveBeenCalledWith(
      expect.objectContaining({ target: "../my-app" }),
      expect.anything(),
    );
  });

  it("rejects the obsolete privacy review argument", async () => {
    const test = fixture();
    const result = await runCreateCli(
      test.command,
      [...argv, "--write", "--privacy-reviewed", "--json"],
      "/factory",
    );
    expect(result.exitCode).toBe(2);
    expect(test.execute).not.toHaveBeenCalled();
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
