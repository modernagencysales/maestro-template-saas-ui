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
] as const;

describe("local hook authority", () => {
  it("keeps only staged format, lint, and advisory Qlty hygiene", () => {
    const hook = read("lefthook.yml");

    expect(hook).toContain("pnpm prettier --write {staged_files}");
    expect(hook).toMatch(/ESLINT_SHIFT_LEFT=1\s+pnpm eslint \{staged_files\}/u);
    expect(hook).toContain("git rev-parse --verify HEAD");
    expect(hook).toMatch(/Skipping inherited baseline lint\s+on/u);
    expect(hook).toContain("pnpm check:qlty -- --staged");
    expect(hook).not.toContain("pre-push-rubric.sh");
    for (const command of BROAD_HOOK_COMMANDS) {
      expect(hook, command).not.toContain(command);
    }
  });

  it("removes the obsolete rubric injection script", () => {
    expect(existsSync(resolve(root, "scripts/pre-push-rubric.sh"))).toBe(false);
  });

  it.each([
    "docs/template/post-port-backlog.md",
    "docs/template/porting-backlog.md",
  ])("does not advertise duplicate pre-push admission in %s", (path) => {
    const instructions = read(path);

    expect(instructions).not.toMatch(
      /pre-push.*(?:deterministic|debt|typecheck|lint|deps|knip|gates)/u,
    );
    expect(instructions).toContain("pre-commit");
    expect(instructions).toContain("Woodpecker");
  });
});

describe("delivery-batch instructions", () => {
  it.each([
    "docs/template/app-factory-guide.md",
    "docs/template/generator-output-contract.md",
  ])(
    "documents reversible generator writes without stale fingerprints in %s",
    (path) => {
      const instructions = read(path);

      expect(instructions).toContain("--write");
      expect(instructions).not.toMatch(
        /scaffold_sha256:|preflight_sha256:|confirmation\.argv/u,
      );
    },
  );

  it("does not advertise removed stack planning authority", () => {
    const planningSkill = read(".claude/skills/planning/SKILL.md");

    expect(planningSkill).not.toMatch(
      /stack:|tooling\/stack|Graphite|Justfile|plan-check/u,
    );
  });

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

  it.each([
    "docs/template/how-to-add-frontend-route.md",
    "docs/template/promotion-boundary.md",
  ])(
    "keeps focused checks local and defers verify to Woodpecker in %s",
    (path) => {
      const instructions = read(path).toLowerCase();

      expect(instructions).toContain("focused");
      expect(instructions).toContain("pnpm verify");
      expect(instructions).toMatch(/delivery\s+batch/u);
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

  it("keeps nested checks unique and focused scripts available", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["check:agent-pack"]).toBe(
      "tsx tooling/agent-pack/src/syncSkills.ts && tsx tooling/quality/check-agent-pack.mts",
    );
    expect(packageJson.scripts["check:app-map"]).toBe(
      "pnpm --dir tooling/app-map check",
    );
    expect(packageJson.scripts["check:confect-manifest"]).toBe(
      "tsx tooling/confect-manifest/src/check.ts",
    );
    expect(packageJson.scripts.verify).toContain("pnpm check:agent-pack");
    expect(packageJson.scripts.verify).toContain("pnpm check:confect-manifest");
    expect(packageJson.scripts.verify).not.toContain("pnpm check:app-map");
  });

  it("connects the required Woodpecker context to CI verification once", () => {
    const pipeline = read(".woodpecker/verify.yml");
    const core = read(".woodpecker/verify-core.yml");
    const coverage = read(".woodpecker/verify-coverage.yml");
    const chassis = read("tooling/ci/verify-chassis.sh");

    expect(pipeline).toContain("- verify-core");
    expect(pipeline).toContain("- verify-coverage");
    expect(pipeline).toContain("node tooling/ci/verify-aggregate.mjs");
    expect(core).toContain("tooling/ci/verify-chassis.sh");
    expect(coverage).toContain("tooling/ci/verify-coverage.sh");
    const gitleaksInstall = chassis.indexOf(
      "bash tooling/ci/install-gitleaks.sh",
    );
    expect(gitleaksInstall).toBeGreaterThan(
      chassis.indexOf("source tooling/ci/setup.sh"),
    );
    expect(gitleaksInstall).toBeLessThan(
      chassis.indexOf("pnpm verify:without-coverage"),
    );
    expect(chassis).not.toContain("install-gitleaks.sh || true");
    expect(chassis.match(/^pnpm verify:without-coverage$/gmu)).toHaveLength(1);
    expect(chassis).not.toMatch(/^pnpm verify$/gmu);
    expect(chassis).not.toContain("pnpm --dir apps/web test:runtime-longevity");
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
