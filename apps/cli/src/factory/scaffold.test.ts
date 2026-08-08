import {
  createScaffoldCommand,
  type ScaffoldDependencies,
  type ScaffoldGeneratorRequest,
  type ScaffoldGeneratorOutput,
} from "@maestro-template/agent-pack";
import { describe, expect, it, vi } from "vitest";
import { runScaffoldCli } from "./scaffold";

const output: ScaffoldGeneratorOutput = {
  files: [{ path: "generated/exact.ts", content: "export {};\n" }],
  provenancePaths: [],
  collisions: [],
  semanticRuleIds: [],
  manualFollowUp: [],
  codegen: [],
  focusedGates: [],
};
function dependencies(
  preflight: {
    safeToMutate: boolean;
    cleanWorktree: boolean;
    fingerprint: string;
  },
  collisions: readonly string[] = [],
  writeCollisions: readonly string[] = [],
) {
  const run = vi.fn(async ({ write }: ScaffoldGeneratorRequest) => ({
    ok: true as const,
    output: {
      ...output,
      collisions: write ? writeCollisions : collisions,
    },
  }));
  const value: ScaffoldDependencies = {
    generators: { resolve: () => ({ supported: true }), run },
    preflight: { inspect: async () => preflight },
    workflow: { semantics: [], reviewedAdrRefs: () => new Set() },
  };
  return { value, run };
}

const writeArgv = [
  "scaffold",
  "--generator",
  "add-capability",
  "--args",
  '{"name":"exact"}',
  "--write",
  "--json",
];

describe("scaffold CLI adapter", () => {
  it("writes despite unrelated worktree changes", async () => {
    const fixture = dependencies({
      safeToMutate: true,
      cleanWorktree: false,
      fingerprint: "preflight_sha256:ok",
    });
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      writeArgv,
      "/fixture",
    );
    expect(result.exitCode).toBe(0);
    expect(fixture.run.mock.calls.map(([request]) => request.write)).toEqual([
      false,
      true,
    ]);
  });

  it("refuses an owned collision found by the write-time recomputation", async () => {
    const fixture = dependencies(
      {
        safeToMutate: true,
        cleanWorktree: false,
        fingerprint: "preflight_sha256:ok",
      },
      [],
      ["generated/exact.ts"],
    );
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      writeArgv,
      "/fixture",
    );

    expect(result.exitCode).not.toBe(0);
    expect(fixture.run.mock.calls.map(([request]) => request.write)).toEqual([
      false,
      true,
    ]);
  });

  it("refuses an initial owned collision before write-time recomputation", async () => {
    const fixture = dependencies(
      {
        safeToMutate: true,
        cleanWorktree: false,
        fingerprint: "preflight_sha256:ok",
      },
      ["generated/exact.ts"],
    );
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      writeArgv,
      "/fixture",
    );

    expect(result.exitCode).not.toBe(0);
    expect(fixture.run.mock.calls.map(([request]) => request.write)).toEqual([
      false,
    ]);
  });

  it("refuses an unsafe preflight before write-time recomputation", async () => {
    const fixture = dependencies({
      safeToMutate: false,
      cleanWorktree: false,
      fingerprint: "preflight_sha256:ok",
    });
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      writeArgv,
      "/fixture",
    );

    expect(result.exitCode).not.toBe(0);
    expect(fixture.run.mock.calls.map(([request]) => request.write)).toEqual([
      false,
    ]);
  });

  it("fails closed for malformed transport arguments", async () => {
    const fixture = dependencies({
      safeToMutate: true,
      cleanWorktree: true,
      fingerprint: "preflight_sha256:ok",
    });
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      ["scaffold", "--generator", "add-capability", "--args", "[]", "--json"],
      "/fixture",
    );
    expect(result.exitCode).toBe(2);
    expect(fixture.run).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate write", [...writeArgv, "--write"]],
    [
      "removed fingerprint flag",
      [...writeArgv, "--preview-fingerprint", "scaffold_sha256:removed"],
    ],
    ["duplicate render mode", [...writeArgv, "--human"]],
    [
      "invalid workflow resolution",
      [...writeArgv, "--workflow-adr", "WF-STEP-ACTION="],
    ],
  ])("fails closed for %s", async (_case, argv) => {
    const fixture = dependencies({
      safeToMutate: true,
      cleanWorktree: true,
      fingerprint: "preflight_sha256:ok",
    });
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      argv,
      "/fixture",
    );

    expect(result.exitCode).toBe(2);
    expect(fixture.run).not.toHaveBeenCalled();
  });
});
