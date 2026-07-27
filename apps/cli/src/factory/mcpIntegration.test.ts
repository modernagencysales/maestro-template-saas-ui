import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createFactoryCliComposition } from "./composition";

describe("root MCP composition", () => {
  it("shares the accepted read and support-preview tools through one stdio adapter", async () => {
    const composition = createFactoryCliComposition(() => ({}));
    const output: string[] = [];
    await composition.mcp.serve({
      stdin: Readable.from([
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`,
      ]),
      stdout: writable(output),
      stderr: writable([]),
      cwd: process.cwd(),
    });
    const frame = JSON.parse(output.join(""));
    expect(
      frame.result.tools.map(({ name }: { name: string }) => name),
    ).toEqual([
      "maestro_preflight",
      "maestro_plan_check",
      "maestro_scaffold_preview",
      "maestro_support_bundle_preview",
      "maestro_verify",
      "maestro_app_map",
      "maestro_app_map_impact",
      "maestro_build_readiness",
    ]);
  });

  it("previews configure without invoking its injected receipt store", async () => {
    const applied: unknown[] = [];
    const composition = createFactoryCliComposition(() => ({}), {
      mcp: {
        observedTools: async () => [
          "data",
          "envGet",
          "envList",
          "envRemove",
          "envSet",
          "functionSpec",
          "insights",
          "logs",
          "run",
          "runOneoffQuery",
          "status",
          "tables",
        ],
        store: {
          apply: async (receipt) => {
            applied.push(receipt);
            return { status: "created" };
          },
          remove: async () => ({ status: "absent" }),
        },
      },
    });
    const result = await composition.mcpConfigure.run(
      ["configure", "--host", "codex", "--json"],
      process.cwd(),
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutationPosture: "preview",
      data: { action: "preview", autoStart: false },
    });
    expect(applied).toEqual([]);

    const written = await composition.mcpConfigure.run(
      [
        "configure",
        "--host",
        "codex",
        "--write",
        "--privacy-reviewed",
        "--json",
      ],
      process.cwd(),
    );
    expect(written.exitCode).toBe(0);
    expect(JSON.parse(written.stdout)).toMatchObject({
      mutationPosture: "write",
      data: { action: "apply", status: "created", autoStart: false },
    });
    expect(applied).toHaveLength(1);
  });
});

function writable(chunks: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
}
