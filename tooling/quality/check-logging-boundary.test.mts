import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateLoggingBoundary } from "./check-logging-boundary.mts";

type FixtureFiles = Record<string, string>;

async function withTempRepo<T>(
  files: FixtureFiles,
  run: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const repoRoot = await mkdtemp(join(tmpdir(), "logging-boundary-"));

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
  return await withTempRepo(files, evaluateLoggingBoundary);
}

describe("check:logging-boundary", () => {
  it("rejects console logging in web runtime code", async () => {
    const result = await evaluateFixture({
      "apps/web/src/features/Bad.ts": `
        export function logProviderPayload(payload: unknown) {
          console.error(payload);
        }
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "apps/web/src/features/Bad.ts",
        method: "error",
      }),
    );
  });

  it("rejects console logging in package runtime code", async () => {
    const result = await evaluateFixture({
      "packages/integrations/src/bad.ts": `
        export const debug = (payload: unknown) => console.log(payload);
      `,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        file: "packages/integrations/src/bad.ts",
        method: "log",
      }),
    );
  });

  it("ignores tests in product roots", async () => {
    const result = await evaluateFixture({
      "packages/integrations/src/debug.test.ts": `
        console.warn("fixture output is okay in tests");
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("allows exact upstream files whose shipped logging is removed by Vite", async () => {
    const paths = [
      "apps/web/src/components/invite-people-modal/invite-people-modal.tsx",
      "apps/web/src/components/manage-tags-modal/manage-tags.tsx",
      "apps/web/src/features/billing/components/pricing-table.tsx",
      "apps/web/src/features/common/components/invite-people.tsx",
      "apps/web/src/features/contacts/list/add-person-dialog.tsx",
      "apps/web/src/features/contacts/list/contact-bulk-actions.tsx",
      "apps/web/src/features/contacts/list/list-page.tsx",
      "apps/web/src/features/settings/billing/manage-billing-button.tsx",
      "apps/web/src/features/settings/billing/plans-page.tsx",
      "apps/web/src/features/settings/tags/manage-tags.tsx",
      "apps/web/src/features/workspaces/invite/accept-invite-page.tsx",
      "packages/i18n/src/provider.server.tsx",
      "packages/i18n/src/provider.tsx",
    ];
    const result = await evaluateFixture(
      Object.fromEntries(
        paths.map((path) => [path, `console.error("upstream");`]),
      ),
    );

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("drops console calls from shipped Vite bundles", () => {
    const config = readFileSync(
      resolve(import.meta.dirname, "../../apps/web/vite.config.ts"),
      "utf8",
    );

    expect(config).toContain('drop: ["console"]');
  });

  it("does not scan tooling scripts", async () => {
    const result = await evaluateFixture({
      "tooling/release/src/index.ts": `
        console.log("operator-facing output");
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });

  it("ignores generated build output", async () => {
    const result = await evaluateFixture({
      "apps/web/.output/server/index.js": `
        console.error("generated bundle output");
      `,
    });

    expect(result).toEqual({ ok: true, findings: [] });
  });
});
