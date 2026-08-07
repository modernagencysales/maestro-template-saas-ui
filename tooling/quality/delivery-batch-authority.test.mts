import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string): string =>
  readFileSync(resolve(root, path), "utf8");

const BROAD_HOOK_COMMANDS = [
  "pnpm typecheck",
  "pnpm test",
  "check:workflow",
  "check:system",
  "check:data-resources",
  "check:append-only-tables",
  "check:promotion-boundary",
  "acceptance:",
  "cucumber",
] as const;

describe("local hook authority", () => {
  it("keeps only staged format, lint, and advisory Qlty hygiene", () => {
    const hook = read("lefthook.yml");

    expect(hook).toContain("pnpm prettier --write {staged_files}");
    expect(hook).toContain("ESLINT_SHIFT_LEFT=1 pnpm eslint {staged_files}");
    expect(hook).toContain("pnpm check:qlty -- --staged");
    expect(hook).not.toContain("pre-push-rubric.sh");
    for (const command of BROAD_HOOK_COMMANDS) {
      expect(hook, command).not.toContain(command);
    }
  });

  it("removes the obsolete rubric injection script", () => {
    expect(existsSync(resolve(root, "scripts/pre-push-rubric.sh"))).toBe(false);
  });
});

describe("delivery-batch instructions", () => {
  it.each([
    "AGENTS.md",
    "docs/template/agent-worker-playbook.md",
    "docs/template/coding-standards.md",
  ])(
    "requires focused commit checks and one batch verification in %s",
    (path) => {
      const instructions = read(path).toLowerCase();

      expect(instructions).toContain("focused");
      expect(instructions).toContain("delivery batch");
      expect(instructions).toMatch(/once|one full/u);
      expect(instructions).toContain("woodpecker");
    },
  );
});

describe("deterministic suite ownership", () => {
  it("keeps workspace suites under root test without verify aliases", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.test).toMatch(
      /^pnpm test:bootstrap && turbo run test /u,
    );
    for (const duplicate of [
      "pnpm test:tooling",
      "pnpm test:workflow",
      "pnpm test:pr-backlog",
      "pnpm evals",
    ]) {
      expect(packageJson.scripts.verify).not.toContain(duplicate);
    }
  });

  it("keeps Qlty advisory and Gitleaks independently blocking in the firewall", () => {
    const firewall = read("tooling/ci/firewall.sh");

    expect(firewall).toContain("if ! bash tooling/ci/install-qlty.sh");
    expect(firewall).toContain("pnpm check:secret-canaries");
    expect(firewall).toContain("pnpm check:qlty -- --diff");
    expect(firewall).not.toContain("pnpm acceptance:");
  });

  it("runs verify once without nested acceptance or repeated post-verify gates", () => {
    const epoch = read("tooling/ci/epoch.sh");
    const phase1 = read("tooling/ci/phase1.sh");

    expect(epoch.match(/pnpm verify/gu)).toHaveLength(1);
    expect(epoch).toContain("if ! bash tooling/ci/install-qlty.sh");
    expect(epoch).not.toContain("pnpm acceptance:");
    expect(phase1.match(/pnpm verify/gu)).toHaveLength(1);
    expect(phase1).toContain("pnpm template:workflow-output-smoke");
    for (const duplicate of [
      "check:system-catalog",
      "check:system-topology",
      "check:data-resources",
      "check:append-only-tables",
      "check:promotion-boundary",
      "check:workflow-semantics",
      "check:convex-ai-files",
      "check:agent-pack",
      "check:app-map",
    ]) {
      expect(phase1, duplicate).not.toContain(duplicate);
    }
  });
});
