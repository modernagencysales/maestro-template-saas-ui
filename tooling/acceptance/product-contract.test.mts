import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type {
  ProductBehavior,
  ProductContract,
} from "../../packages/template-core/src/productContract";
import {
  compareProductContractHistory,
  checkProductContract,
  deriveTrustedMergeBase,
  generateProductContract,
  parsePlanFrontmatter,
  validateAcceptanceDiscovery,
} from "./product-contract.mts";

const contractPath = "product.contract.yaml";
const schemaPath = "product.contract.schema.json";
const generatedPath = "docs/template/generated/product-contract.md";

const behavior = (
  overrides: Partial<ProductBehavior> = {},
): ProductBehavior => ({
  id: "BHV-REC-001",
  revision: 1,
  status: "draft",
  title: "A record appears",
  actor: "workspace member",
  surfaces: ["web-ui"],
  preconditions: ["The member has a workspace."],
  action: "The member saves a record.",
  outcomes: ["The record is listed."],
  ...overrides,
});

const contract = (item: ProductBehavior = behavior()): ProductContract => ({
  schemaVersion: 1,
  product: { id: "records", name: "Records", summary: "Manage records." },
  behaviors: [item],
});

const withBehavior = (
  source: ProductContract,
  item: ProductBehavior,
): ProductContract => ({ ...source, behaviors: [item] });

describe("product contract tooling", () => {
  it("loads only a leading typed plan frontmatter block", () => {
    expect(
      parsePlanFrontmatter("# Untyped\n", "docs/plain.md"),
    ).toBeUndefined();
    expect(() =>
      parsePlanFrontmatter("---\nplanSchemaVersion: 1\n---\n", "docs/bad.md"),
    ).toThrow();
    expect(
      parsePlanFrontmatter(
        `---
planSchemaVersion: 1
productContract: product.contract.yaml
workPackages:
  - id: WP-REC-001
    behaviorIds: [BHV-REC-001]
    appMapTargets: [route:records]
    work:
      kind: template-gap
      target: records
      templateBacklogRef: AP-001
      templateResolutionPath: records adapter
      followUpGates: [check:records]
proofs:
  - behavior: BHV-REC-001
    behaviorRevision: 1
    level: black-box
    surfaces: [web-ui]
    observation: The record appears.
    failureWitness: The record would be absent.
---
# Plan
`,
        "docs/plan.md",
      ),
    ).toMatchObject({ planSchemaVersion: 1 });
  });

  it("enforces lifecycle, revision, semantic, deletion, and retired immutability history", () => {
    const trusted = contract();
    expect(
      compareProductContractHistory(
        trusted,
        withBehavior(trusted, behavior({ status: "required" })),
      ),
    ).toEqual([]);
    expect(
      compareProductContractHistory(
        trusted,
        withBehavior(
          trusted,
          behavior({ status: "retired", retirementReason: "replaced" }),
        ),
      ),
    ).toEqual([]);
    expect(
      compareProductContractHistory(
        withBehavior(trusted, behavior({ status: "required" })),
        withBehavior(
          trusted,
          behavior({ status: "retired", retirementReason: "replaced" }),
        ),
      ),
    ).toEqual([]);
    expect(
      compareProductContractHistory(
        withBehavior(trusted, behavior({ status: "required" })),
        withBehavior(trusted, behavior({ status: "draft" })),
      ),
    ).toMatchObject([expect.stringMatching(/required.*draft/i)]);
    const retired = withBehavior(
      trusted,
      behavior({ status: "retired", retirementReason: "replaced" }),
    );
    expect(
      compareProductContractHistory(
        retired,
        withBehavior(retired, behavior({ status: "required" })),
      ),
    ).toMatchObject([expect.stringMatching(/retired.*immutable|transition/i)]);
    expect(
      compareProductContractHistory(
        retired,
        withBehavior(
          retired,
          behavior({ status: "retired", retirementReason: "edited" }),
        ),
      ),
    ).toMatchObject([expect.stringMatching(/retired.*immutable/i)]);
    expect(
      compareProductContractHistory(
        withBehavior(trusted, behavior({ revision: 2 })),
        trusted,
      ),
    ).toMatchObject([expect.stringMatching(/revision/i)]);
    expect(
      compareProductContractHistory(
        trusted,
        withBehavior(
          trusted,
          behavior({ action: "The member deletes a record." }),
        ),
      ),
    ).toMatchObject([expect.stringMatching(/revision/i)]);
    expect(
      compareProductContractHistory(
        trusted,
        withBehavior(
          trusted,
          behavior({ revision: 2, action: "The member deletes a record." }),
        ),
      ),
    ).toEqual([]);
    expect(
      compareProductContractHistory(
        trusted,
        contract(behavior({ id: "BHV-REC-002" })),
      ),
    ).toMatchObject([expect.stringMatching(/deleted|missing/i)]);
  });

  it("joins revision-bound acceptance discovery exactly once", () => {
    const required = behavior({ status: "required" });
    const current = contract(required);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          {
            id: "one",
            file: "one.ts",
            title: "one",
            behaviorTag: "@BHV-REC-001-R1",
          },
        ],
      }),
    ).toEqual([]);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          {
            id: "one",
            file: "one.ts",
            title: "one",
            behaviorTag: "@BHV-REC-001-R2",
          },
        ],
      }).join("\n"),
    ).toMatch(/stale revision/i);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          {
            id: "one",
            file: "one.ts",
            title: "one",
            behaviorTag: "@BHV-REC-001-R1",
          },
          {
            id: "two",
            file: "two.ts",
            title: "two",
            behaviorTag: "@BHV-REC-001-R1",
          },
        ],
      }),
    ).toEqual([]);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          { id: "one", file: "one.ts", title: "one", behaviorTag: "not-a-tag" },
        ],
      }).join("\n"),
    ).toMatch(/invalid behavior tag/i);
  });

  it("derives a safe canonical merge base without HEAD~1", () => {
    const calls: string[][] = [];
    expect(
      deriveTrustedMergeBase(
        (args) => {
          calls.push([...args]);
          if (args[0] === "rev-parse") return "a".repeat(40);
          return "b".repeat(40);
        },
        { CI_COMMIT_TARGET_BRANCH: "release/2026" },
      ),
    ).toBe("b".repeat(40));
    expect(calls).not.toContainEqual(expect.arrayContaining(["HEAD~1"]));
  });

  it("renders deterministic projections without verification claims", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-"));
    await mkdir(join(root, "docs", "template", "generated"), {
      recursive: true,
    });
    await writeFile(
      join(root, "product.contract.yaml"),
      `schemaVersion: 1\nproduct:\n  id: records\n  name: Records\n  summary: Manage records.\nbehaviors:\n  - id: BHV-REC-001\n    revision: 1\n    status: draft\n    title: A record appears\n    actor: workspace member\n    surfaces: [web-ui]\n    preconditions: []\n    action: The member saves a record.\n    outcomes: [The record is listed.]\n`,
    );
    await writeFile(
      join(root, "docs", "records.md"),
      `---\nplanSchemaVersion: 1\nproductContract: product.contract.yaml\nworkPackages:\n  - id: WP-REC-001\n    behaviorIds: [BHV-REC-001]\n    appMapTargets: [route:records]\n    work:\n      kind: template-gap\n      target: records\n      templateBacklogRef: AP-001\n      templateResolutionPath: records adapter\n      followUpGates: [check:records]\nproofs:\n  - behavior: BHV-REC-001\n    behaviorRevision: 1\n    level: black-box\n    surfaces: [web-ui]\n    observation: The record appears.\n    failureWitness: It would be absent.\n---\n# Plan\n`,
    );
    await generateProductContract({ repoRoot: root, sourceRoot: "." });
    const rendered = await readFile(
      join(root, "docs", "template", "generated", "product-contract.md"),
      "utf8",
    );
    expect(rendered).not.toMatch(/verified\s*:/i);
    expect(rendered).toContain("route:records");
    expect(
      await readFile(join(root, "product.contract.schema.json"), "utf8"),
    ).toContain("schemaVersion");
  });

  it("uses real temporary git history for bootstrap guard regression", () => {
    const root = execFileSync("mktemp", ["-d"], { encoding: "utf8" }).trim();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: root,
    });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    writeFileSync(join(root, "README.md"), "root\n");
    execFileSync("git", ["add", "README.md"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "root"], {
      cwd: root,
      env: { ...process.env, LEFTHOOK: "0" },
    });
    expect(
      execFileSync(
        "git",
        ["log", "--format=%H", "HEAD", "--", "product.contract.yaml"],
        { cwd: root, encoding: "utf8" },
      ),
    ).toBe("");
  });

  it("allows the first contract only when trusted history has never contained it", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-bootstrap-"));
    const git = (args: readonly string[]) =>
      execFileSync("git", [...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    writeFileSync(join(root, "README.md"), "root\n");
    git(["add", "README.md"]);
    git(["commit", "-qm", "root"]);
    git(["switch", "-q", "-c", "feature"]);
    writeFileSync(
      join(root, contractPath),
      `schemaVersion: 1
product:
  id: records
  name: Records
  summary: Manage records.
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: draft
    title: A record appears
    actor: workspace member
    surfaces: [web-ui]
    preconditions: []
    action: The member saves a record.
    outcomes: [The record is listed.]
`,
    );
    await generateProductContract({ repoRoot: root, sourceRoot: "." });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "first contract"]);
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
      });
      expect(findings).not.toContain(
        "trusted contract is missing but existed in target history",
      );
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });

  it("rejects bootstrap after a contract was added and deleted on the trusted branch", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-history-"));
    const git = (args: readonly string[]) =>
      execFileSync("git", [...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    writeFileSync(join(root, "README.md"), "root\n");
    git(["add", "README.md"]);
    git(["commit", "-qm", "root"]);
    const contractYaml = `schemaVersion: 1
product:
  id: records
  name: Records
  summary: Manage records.
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: draft
    title: A record appears
    actor: workspace member
    surfaces: [web-ui]
    preconditions: []
    action: The member saves a record.
    outcomes: [The record is listed.]
`;
    writeFileSync(join(root, contractPath), contractYaml);
    git(["add", contractPath]);
    git(["commit", "-qm", "add contract"]);
    git(["rm", "-q", contractPath]);
    git(["commit", "-qm", "delete contract"]);
    git(["switch", "-q", "-c", "feature"]);
    writeFileSync(join(root, contractPath), contractYaml);
    await generateProductContract({ repoRoot: root, sourceRoot: "." });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "recreate contract"]);
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
      });
      expect(findings.join("\n")).toMatch(
        /trusted contract is missing.*target history/i,
      );
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });
});
