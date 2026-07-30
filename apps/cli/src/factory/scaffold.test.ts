import {
  createScaffoldCommand,
  fingerprintScaffoldPreview,
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
const previewFingerprint = fingerprintScaffoldPreview(
  { generatorId: "add-capability", args: { name: "exact" } },
  output,
);

function dependencies(
  preflight: {
    safeToMutate: boolean;
    cleanWorktree: boolean;
    fingerprint: string;
  },
  collisions: readonly string[] = [],
) {
  const run = vi.fn(async ({ write }: ScaffoldGeneratorRequest) => ({
    ok: true as const,
    output: { ...output, collisions: write ? [] : collisions },
  }));
  const value: ScaffoldDependencies = {
    generators: { resolve: () => ({ supported: true }), run },
    preflight: { inspect: async () => preflight },
    workflow: { semantics: [], reviewedAdrRefs: () => new Set() },
  };
  return { value, run };
}

const writeArgv = (fingerprint?: string) => [
  "scaffold",
  "--generator",
  "add-capability",
  "--args",
  '{"name":"exact"}',
  "--write",
  "--preview-fingerprint",
  previewFingerprint,
  ...(fingerprint === undefined
    ? []
    : ["--preflight-fingerprint", fingerprint]),
  "--json",
];

describe("scaffold CLI adapter", () => {
  it.each([
    [
      "dirty",
      {
        safeToMutate: true,
        cleanWorktree: false,
        fingerprint: "preflight_sha256:ok",
      },
      [],
      "preflight_sha256:ok",
    ],
    [
      "collision",
      {
        safeToMutate: true,
        cleanWorktree: true,
        fingerprint: "preflight_sha256:ok",
      },
      ["generated/exact.ts"],
      "preflight_sha256:ok",
    ],
    [
      "stale",
      {
        safeToMutate: true,
        cleanWorktree: true,
        fingerprint: "preflight_sha256:new",
      },
      [],
      "preflight_sha256:old",
    ],
    [
      "missing",
      {
        safeToMutate: true,
        cleanWorktree: true,
        fingerprint: "preflight_sha256:ok",
      },
      [],
      undefined,
    ],
    [
      "blocking",
      {
        safeToMutate: false,
        cleanWorktree: true,
        fingerprint: "preflight_sha256:ok",
      },
      [],
      "preflight_sha256:ok",
    ],
  ] as const)(
    "never writes for %s preflight evidence",
    async (_case, preflight, collisions, fingerprint) => {
      const fixture = dependencies(preflight, collisions);
      const result = await runScaffoldCli(
        createScaffoldCommand(fixture.value),
        writeArgv(fingerprint),
        "/fixture",
      );
      expect(result.exitCode).not.toBe(0);
      expect(fixture.run.mock.calls.some(([request]) => request.write)).toBe(
        false,
      );
    },
  );

  it("writes with a matching clean fingerprint", async () => {
    const fixture = dependencies({
      safeToMutate: true,
      cleanWorktree: true,
      fingerprint: "preflight_sha256:ok",
    });
    const result = await runScaffoldCli(
      createScaffoldCommand(fixture.value),
      writeArgv("preflight_sha256:ok"),
      "/fixture",
    );
    expect(result.exitCode).toBe(0);
    expect(fixture.run.mock.calls.map(([request]) => request.write)).toEqual([
      false,
      true,
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
});
