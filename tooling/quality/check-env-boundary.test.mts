import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateEnvBoundary } from "./check-env-boundary.mts";

type FixtureFiles = Record<string, string>;

async function withTempRepo<T>(
  files: FixtureFiles,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "env-boundary-"));

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
  return await withTempRepo(files, evaluateEnvBoundary);
}

describe("check:env-boundary", () => {
  it("rejects process.env reads in product app code", async () => {
    const result = await evaluateFixture({
      "apps/web/src/features/Bad.ts": `
        export const apiKey = process.env.OPENROUTER_API_KEY;
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/features/Bad.ts",
        message: expect.stringContaining("process.env"),
      }),
    );
  });

  it("rejects import.meta.env reads outside the web env shim", async () => {
    const result = await evaluateFixture({
      "apps/web/src/features/Bad.ts": `
        export const convexUrl = import.meta.env.VITE_CONVEX_URL;
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/features/Bad.ts",
        message: expect.stringContaining("import.meta.env"),
      }),
    );
  });

  it("rejects Deno.env reads in packages", async () => {
    const result = await evaluateFixture({
      "packages/integrations/src/bad.ts": `
        export const token = Deno.env.get("TOKEN");
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "packages/integrations/src/bad.ts",
        message: expect.stringContaining("Deno.env"),
      }),
    );
  });

  it("allows approved env boundary files", async () => {
    const result = await evaluateFixture({
      "apps/cli/src/index.ts": `
        export const env = process.env;
      `,
      "apps/web/src/env.ts": `
        export const env = import.meta.env;
      `,
      "packages/convex/confect/shared/env.ts": `
        export const runtimeMode = process.env.TEMPLATE_RUNTIME_MODE;
      `,
      "packages/convex/confect/email/env.ts": `
        export const webhookUsername = process.env.POSTMARK_WEBHOOK_USERNAME;
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("ignores tests while scanning product roots", async () => {
    const result = await evaluateFixture({
      "packages/integrations/src/env.test.ts": `
        process.env.TEST_VALUE = "fixture";
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });
});
