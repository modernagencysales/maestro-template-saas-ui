import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateFrontendEffectBoundary } from "./check-frontend-effect-boundary.mts";

type FixtureFiles = Record<string, string>;

async function withTempRepo<T>(
  files: FixtureFiles,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "frontend-effect-boundary-"));

  try {
    for (const [path, contents] of Object.entries(files)) {
      const fullPath = join(repoRoot, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, contents);
    }

    return await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function evaluateFixture(files: FixtureFiles) {
  return await withTempRepo(files, evaluateFrontendEffectBoundary);
}

describe("check:frontend-effect-boundary", () => {
  it("rejects Effect runtime execution outside the effect boundary adapter", async () => {
    const result = await evaluateFixture({
      "apps/web/src/components/Bad.tsx": `
        import * as Effect from "effect/Effect";

        export const Bad = () => {
          void Effect.runPromise(Effect.succeed("leaked"));
          void Effect.runSync(Effect.succeed("also leaked"));
          return null;
        };
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/components/Bad.tsx",
        message: expect.stringContaining("Effect runtime execution"),
      }),
    );
    expect(result.findings).toHaveLength(2);
  });

  it("allows Effect.runPromise inside the effect boundary adapter", async () => {
    const result = await evaluateFixture({
      "apps/web/src/adapters/effectBoundary.ts": `
        import * as Effect from "effect/Effect";

        export const runClientEffect = <A>(program: Effect.Effect<A>) =>
          Effect.runPromise(program);
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("rejects client imports from the effect barrel", async () => {
    const result = await evaluateFixture({
      "packages/editor-react/src/Bad.tsx": `
        import { Effect } from "effect";

        export const program = Effect.succeed("barrel");
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "packages/editor-react/src/Bad.tsx",
        message: expect.stringContaining("effect barrel"),
      }),
    );
  });

  it("allows client imports from Effect submodules", async () => {
    const result = await evaluateFixture({
      "packages/workflow-ui/src/Good.tsx": `
        import * as Effect from "effect/Effect";

        export const program = Effect.succeed("submodule");
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("rejects Effect Atom imports outside approved frontend prefixes", async () => {
    const result = await evaluateFixture({
      "apps/web/src/components/BadAtom.tsx": `
        import { Atom } from "@effect-atom/atom-react";

        export const atom = Atom.make("outside approved boundary");
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/components/BadAtom.tsx",
        message: expect.stringContaining("@effect-atom/*"),
      }),
    );
  });

  it("allows Effect Atom imports behind approved frontend adapter prefixes", async () => {
    const result = await evaluateFixture({
      "packages/frontend-effect/index.ts": `
        import { Atom } from "@effect-atom/atom-react";

        export const atom = Atom.make("approved adapter boundary");
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });
});
