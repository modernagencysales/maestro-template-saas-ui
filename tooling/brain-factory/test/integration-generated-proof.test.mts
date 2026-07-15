import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { proveIntegrationGeneratedOutput } from "../src/integration-generated-proof.js";

const roots: string[] = [];
const git = (root: string, ...args: string[]): string =>
  execFileSync("rtk", ["proxy", "git", ...args], {
    cwd: root,
    encoding: "utf8",
  }).trim();

const repository = () => {
  const root = mkdtempSync(resolve(tmpdir(), "wave-generated-proof-"));
  roots.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.email", "wave@example.test");
  git(root, "config", "user.name", "Wave Test");
  writeFileSync(resolve(root, ".gitignore"), ".tokensave/\n");
  writeFileSync(resolve(root, "source.ts"), "export const source = 0;\n");
  git(root, "add", ".gitignore", "source.ts");
  git(root, "commit", "-qm", "test: base");
  const baseSha = git(root, "rev-parse", "HEAD");
  writeFileSync(resolve(root, "source.ts"), "export const source = 1;\n");
  mkdirSync(resolve(root, "generated"));
  writeFileSync(
    resolve(root, "generated/output.ts"),
    "export const value = 1;\n",
  );
  git(root, "add", ".");
  git(root, "commit", "-qm", "test: generated head");
  return { baseSha, headSha: git(root, "rev-parse", "HEAD"), root };
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe("integration generated-output proof", () => {
  it("accepts only output reproduced from exact-head source", () => {
    const value = repository();
    expect(
      proveIntegrationGeneratedOutput({
        ...value,
        generatedFiles: ["generated/output.ts"],
        hooks: {
          generate: (workdir) => {
            git(workdir, "checkout", "HEAD", "--", ".gitignore");
            mkdirSync(resolve(workdir, "generated"), { recursive: true });
            writeFileSync(
              resolve(workdir, "generated/output.ts"),
              "export const value = 1;\n",
            );
          },
          hydrate: () => undefined,
        },
      }),
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects an arbitrary generated-path addition and cleans up", () => {
    const value = repository();
    expect(() =>
      proveIntegrationGeneratedOutput({
        ...value,
        generatedFiles: ["generated/output.ts"],
        hooks: {
          generate: () => undefined,
          hydrate: () => undefined,
        },
      }),
    ).toThrow("not reproducible at exact head");
    expect(git(value.root, "status", "--porcelain")).toBe("");
    expect(git(value.root, "worktree", "list", "--porcelain")).not.toContain(
      "brain-wave-generated-",
    );
  });
});
