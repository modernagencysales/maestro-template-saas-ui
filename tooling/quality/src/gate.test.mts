import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { evaluateStaticCheck, runStaticCheck } from "./gate.mts";

async function withRepo<T>(
  files: Record<string, string>,
  run: (repo: string) => Promise<T>,
): Promise<T> {
  const repo = await mkdtemp(join(tmpdir(), "maestro-template-gate-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(repo, path);
      await writeFile(fullPath, content, { flag: "w" });
    }
    return await run(repo);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
}

describe("evaluateStaticCheck", () => {
  it("passes when every required file and pattern is present", async () => {
    const result = await withRepo(
      { "README.md": "hello template\n" },
      async (repo) =>
        evaluateStaticCheck(repo, {
          name: "docs",
          requirements: [
            {
              file: "README.md",
              includes: ["template"],
              message: "README must describe the template",
            },
          ],
        }),
    );

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("matches required command strings across formatter whitespace", async () => {
    const result = await withRepo(
      { "lefthook.yml": "ESLINT_SHIFT_LEFT=1\n  pnpm eslint {staged_files}\n" },
      async (repo) =>
        evaluateStaticCheck(repo, {
          name: "hooks",
          requirements: [
            {
              file: "lefthook.yml",
              includes: ["ESLINT_SHIFT_LEFT=1 pnpm eslint {staged_files}"],
              message: "hook must preserve staged lint",
            },
          ],
        }),
    );

    expect(result).toEqual({ ok: true, failures: [] });
  });

  it("fails with a specific message when a required pattern is missing", async () => {
    const result = await withRepo({ "README.md": "hello\n" }, async (repo) =>
      evaluateStaticCheck(repo, {
        name: "docs",
        requirements: [
          {
            file: "README.md",
            includes: ["template"],
            message: "README must describe the template",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "README must describe the template: README.md is missing `template`",
    ]);
  });

  it("reports successful static checks without a pin-only claim", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await withRepo({ "README.md": "template\n" }, async (repo) =>
      runStaticCheck(
        {
          name: "docs",
          requirements: [
            {
              file: "README.md",
              includes: ["template"],
              message: "README must describe the template",
            },
          ],
        },
        repo,
      ),
    );
    expect(log).toHaveBeenCalledWith("docs: ok");
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("pin-only"));
  });
});
