import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
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
  parseProductContractArguments,
  parsePlanFrontmatter,
  validateAcceptanceDiscovery,
} from "./product-contract.mts";
import {
  assertCheckoutState,
  snapshotCheckoutState,
} from "./checkout-state.mts";
import type { ParsedPlaywrightJsonReport } from "./playwright-report.mts";

const contractPath = "product.contract.yaml";
const schemaPath = "product.contract.schema.json";
const generatedPath = "docs/template/generated/product-contract.md";

const reportFor = (
  file: string,
  sourceRoot = "/fixture",
): ParsedPlaywrightJsonReport => ({
  config: {
    rootDir: `${sourceRoot}/tests/acceptance`,
    workers: 1,
    forbidOnly: true,
    fullyParallel: false,
    globalSetup: null,
    globalTeardown: null,
    webServer: null,
    repeatEach: null,
    testIgnore: null,
    projects: [
      {
        name: "acceptance-chromium",
        retries: 0,
        repeatEach: 1,
        testIgnore: [],
        testDir: `${sourceRoot}/tests/acceptance`,
        testMatch: "**/*.spec.ts",
      },
    ],
  },
  tests: [
    {
      id: "spec-001",
      file,
      title: "record appears",
      behaviorTag: "@BHV-REC-001-R1",
      expectedStatus: "passed",
      annotations: [],
      results: [],
    },
  ],
});

const emptyReport = (sourceRoot = "/fixture"): ParsedPlaywrightJsonReport => ({
  config: {
    rootDir: `${sourceRoot}/tests/acceptance`,
    workers: 1,
    forbidOnly: true,
    fullyParallel: false,
    globalSetup: null,
    globalTeardown: null,
    webServer: null,
    repeatEach: null,
    testIgnore: null,
    projects: [
      {
        name: "acceptance-chromium",
        retries: 0,
        repeatEach: 1,
        testIgnore: [],
        testDir: `${sourceRoot}/tests/acceptance`,
        testMatch: "**/*.spec.ts",
      },
    ],
  },
  tests: [],
});

const discoveredTest = (
  overrides: Partial<ParsedPlaywrightJsonReport["tests"][number]> = {},
): ParsedPlaywrightJsonReport["tests"][number] => ({
  id: "spec-001",
  file: "records.spec.ts",
  title: "record appears",
  behaviorTag: "@BHV-REC-001-R1",
  expectedStatus: "passed",
  annotations: [],
  results: [],
  ...overrides,
});

const contractYaml = (status: string): string => `schemaVersion: 1
product:
  id: records
  name: Records
  summary: Manage records.
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: ${status}
    title: A record appears
    actor: workspace member
    surfaces: [web-ui]
    preconditions: []
    action: The member saves a record.
    outcomes: [The record is listed.]
${status === "retired" ? "    retirementReason: replaced\n" : ""}`;

const planYaml = (
  packages: readonly (readonly [string, string, string])[],
): string => `---
planSchemaVersion: 1
productContract: product.contract.yaml
workPackages:
${packages
  .map(
    ([target, kind, name], index) => `  - id: WP-REC-00${index + 1}
    behaviorIds: [BHV-REC-001]
    appMapTargets: [${target}]
    work:
      kind: ${kind}
      target: ${name}
      ${kind === "template-gap" ? "templateBacklogRef: AP-001\n      templateResolutionPath: records adapter" : kind === "pattern-instance" ? "generatorCommand: pnpm template:add-feature" : "persistenceOrProviderBoundary: records repository"}
      followUpGates: [check:records]
      frontend:
        screenCatalogId: starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx
        sourceReceipt: docs/template/saas-ui-starter-files.json
        shellId: app-shell
        allowedAdaptations: [route-binding, data-adapter]
        requiredVisualStates: [loading, empty, error, populated, selected, mutation]
`,
  )
  .join("")}proofs:
  - behavior: BHV-REC-001
    behaviorRevision: 1
    level: black-box
    surfaces: [web-ui]
    observation: The record appears.
    failureWitness: The record is absent.
---
# Plan
`;

const initGit = async (root: string, sourceRoot = "."): Promise<void> => {
  writeFileSync(join(root, "README.md"), "root\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "root"], {
    cwd: root,
    env: { ...process.env, LEFTHOOK: "0" },
  });
  const prefix = sourceRoot === "." ? "" : `${sourceRoot}/`;
  execFileSync(
    "git",
    ["add", "--", `${prefix}product.contract.yaml`, `${prefix}docs/records.md`],
    { cwd: root },
  );
  execFileSync("git", ["commit", "-qm", "trusted contract"], {
    cwd: root,
    env: { ...process.env, LEFTHOOK: "0" },
  });
  execFileSync("git", ["switch", "-q", "-c", "feature"], { cwd: root });
};

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
  it("binds shared config for a nested linked worktree source", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-linked-"));
    const sourceRoot = join(root, "nested", "source");
    await mkdir(join(sourceRoot, "docs"), { recursive: true });
    await writeFile(
      join(sourceRoot, "product.contract.yaml"),
      contractYaml("draft"),
    );
    await writeFile(
      join(sourceRoot, "docs", "records.md"),
      planYaml([["route:records", "template-gap", "records"]]),
    );
    await initGit(root, "nested/source");
    const worktree = join(root, "linked");
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], {
      cwd: root,
    });
    const initial = snapshotCheckoutState(join(worktree, "nested", "source"));
    execFileSync("git", ["config", "core.worktree", join(root, "redirected")], {
      cwd: root,
    });
    expect(() => assertCheckoutState(initial, "checkout changed")).toThrow(
      "checkout changed",
    );
  });

  it("rejects a checkout mutation from native Playwright discovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-checkout-"));
    const sourceRoot = root;
    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "tests", "acceptance"), { recursive: true });
    await writeFile(join(root, "product.contract.yaml"), contractYaml("draft"));
    await writeFile(
      join(root, "docs", "records.md"),
      planYaml([["route:records", "template-gap", "records"]]),
    );
    await writeFile(
      join(root, "tests", "acceptance", "records.spec.ts"),
      "original\n",
    );
    await initGit(root);
    execFileSync("git", ["add", "tests/acceptance/records.spec.ts"], {
      cwd: root,
    });
    execFileSync("git", ["commit", "-qm", "acceptance spec"], {
      cwd: root,
      env: { ...process.env, LEFTHOOK: "0" },
    });
    const report = JSON.stringify({
      config: reportFor("tests/acceptance/records.spec.ts", sourceRoot).config,
      suites: [
        {
          file: "tests/acceptance/records.spec.ts",
          specs: [
            {
              id: "spec-001",
              title: "record appears",
              tags: ["BHV-REC-001-R1"],
              tests: [
                {
                  projectName: "acceptance-chromium",
                  expectedStatus: "passed",
                  annotations: [],
                  results: [],
                },
              ],
            },
          ],
        },
      ],
    });
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      `#!/bin/sh\ngit update-index --assume-unchanged tests/acceptance/records.spec.ts\nprintf 'counterfeit\\n' > tests/acceptance/records.spec.ts\nprintf '%s' '${report}'\n`,
    );
    await chmod(join(bin, "pnpm"), 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? ""}`;
    try {
      await expect(
        generateProductContract({ repoRoot: root, sourceRoot: "." }),
      ).rejects.toThrow(/checkout.*source mutation.*discovery/i);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("checks native discovery from a bounded nested source root", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-nested-"));
    const repoRoot = await realpath(root);
    const sourceRoot = join(repoRoot, "nested", "source");
    await mkdir(join(sourceRoot, "docs"), { recursive: true });
    await mkdir(join(sourceRoot, "tests", "acceptance"), { recursive: true });
    await writeFile(
      join(sourceRoot, "product.contract.yaml"),
      contractYaml("draft"),
    );
    await writeFile(
      join(sourceRoot, "docs", "records.md"),
      planYaml([["route:records", "template-gap", "records"]]),
    );
    await writeFile(
      join(sourceRoot, "tests", "acceptance", "records.spec.ts"),
      "original\n",
    );
    await initGit(root, "nested/source");
    execFileSync(
      "git",
      ["add", "nested/source/tests/acceptance/records.spec.ts"],
      {
        cwd: root,
      },
    );
    execFileSync("git", ["commit", "-qm", "acceptance spec"], {
      cwd: root,
      env: { ...process.env, LEFTHOOK: "0" },
    });
    const report = JSON.stringify({
      config: reportFor("tests/acceptance/records.spec.ts", sourceRoot).config,
      suites: [
        {
          file: "tests/acceptance/records.spec.ts",
          specs: [
            {
              id: "spec-001",
              title: "record appears",
              tags: ["BHV-REC-001-R1"],
              tests: [
                {
                  projectName: "acceptance-chromium",
                  expectedStatus: "passed",
                  annotations: [],
                  results: [],
                },
              ],
            },
          ],
        },
      ],
    });
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(join(bin, "pnpm"), `#!/bin/sh\nprintf '%s' '${report}'\n`);
    await chmod(join(bin, "pnpm"), 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? ""}`;
    try {
      const findings = await checkProductContract({
        repoRoot,
        sourceRoot: "nested/source",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(["route:records"]),
      });
      expect(findings.join("\n")).not.toMatch(/Playwright discovery failed/i);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("rejects root checkout mutation when nested discovery exits nonzero", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "product-contract-root-checkout-"),
    );
    const sourceRoot = join(root, "nested", "source");
    await mkdir(join(sourceRoot, "docs"), { recursive: true });
    await mkdir(join(sourceRoot, "tests", "acceptance"), { recursive: true });
    await writeFile(
      join(sourceRoot, "product.contract.yaml"),
      contractYaml("draft"),
    );
    await writeFile(
      join(sourceRoot, "docs", "records.md"),
      planYaml([["route:records", "template-gap", "records"]]),
    );
    await writeFile(
      join(sourceRoot, "tests", "acceptance", "records.spec.ts"),
      "original\n",
    );
    await initGit(root, "nested/source");
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(
      join(bin, "pnpm"),
      "#!/bin/sh\ngit update-index --assume-unchanged README.md\nprintf 'counterfeit\\n' > README.md\ngit config core.worktree \"$PWD/redirected\"\nexit 1\n",
    );
    await chmod(join(bin, "pnpm"), 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? ""}`;
    try {
      await expect(
        generateProductContract({
          repoRoot: root,
          sourceRoot: "nested/source",
        }),
      ).rejects.toThrow(/checkout.*source mutation.*discovery/i);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("loads only a leading typed plan frontmatter block", () => {
    expect(
      parsePlanFrontmatter("# Untyped\n", "docs/plain.md"),
    ).toBeUndefined();
    expect(() =>
      parsePlanFrontmatter("---\nplanSchemaVersion: 1\n---\n", "docs/bad.md"),
    ).toThrow();
    expect(() =>
      parsePlanFrontmatter("---\nplanSchemaVersion: 1\n", "docs/unclosed.md"),
    ).toThrow(/frontmatter|closing/i);
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
      frontend:
        screenCatalogId: starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx
        sourceReceipt: docs/template/saas-ui-starter-files.json
        shellId: app-shell
        allowedAdaptations: [route-binding, data-adapter]
        requiredVisualStates: [loading, empty, error, populated, selected, mutation]
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
        tests: [discoveredTest({ id: "one", file: "one.ts", title: "one" })],
      }),
    ).toEqual([]);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          discoveredTest({
            id: "one",
            file: "one.ts",
            title: "one",
            behaviorTag: "@BHV-REC-001-R2",
          }),
        ],
      }).join("\n"),
    ).toMatch(/stale revision/i);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          discoveredTest({ id: "one", file: "one.ts", title: "one" }),
          discoveredTest({ id: "two", file: "two.ts", title: "two" }),
        ],
      }),
    ).toEqual([]);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          discoveredTest({
            id: "one",
            file: "one.ts",
            title: "one",
            behaviorTag: "not-a-tag",
          }),
        ],
      }).join("\n"),
    ).toMatch(/invalid behavior tag/i);
    expect(
      validateAcceptanceDiscovery({
        contract: contract(behavior()),
        tests: [],
      }),
    ).toEqual([]);
    expect(
      validateAcceptanceDiscovery({ contract: current, tests: [] }).join("\n"),
    ).toMatch(/at least one|missing/i);
    expect(
      validateAcceptanceDiscovery({
        contract: contract(
          behavior({ status: "retired", retirementReason: "replaced" }),
        ),
        tests: [
          discoveredTest({
            id: "retired",
            file: "retired.ts",
            title: "retired",
          }),
        ],
      }).join("\n"),
    ).toMatch(/retired/i);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [
          discoveredTest({
            id: "unknown",
            file: "unknown.ts",
            title: "unknown",
            behaviorTag: "@BHV-NOPE-001-R1",
          }),
        ],
      }).join("\n"),
    ).toMatch(/unknown/i);
  });

  it("rejects discovery metadata that suppresses acceptance execution", () => {
    const current = contract(behavior({ status: "required" }));
    for (const test of [
      discoveredTest({ expectedStatus: "failed" }),
      discoveredTest({ annotations: [{ type: "skip" }] }),
      discoveredTest({ annotations: [{ type: "fixme" }] }),
      discoveredTest({ annotations: [{ type: "fail" }] }),
    ])
      expect(
        validateAcceptanceDiscovery({ contract: current, tests: [test] }),
      ).not.toEqual([]);
    expect(
      validateAcceptanceDiscovery({
        contract: current,
        tests: [discoveredTest({ annotations: [{ type: "slow" }] })],
      }),
    ).toEqual([]);
  });

  it("rejects every CLI form outside the documented grammar", () => {
    expect(
      parseProductContractArguments([
        "generate",
        "--source-root",
        "seed/source",
      ]),
    ).toEqual({
      mode: "generate",
      sourceRoot: "seed/source",
      allowFirstContract: false,
    });
    expect(
      parseProductContractArguments([
        "check",
        "--source-root",
        ".",
        "--allow-first-contract",
      ]).allowFirstContract,
    ).toBe(true);
    for (const argv of [
      ["generate", "--source-root", "seed/source", "--allow-first-contract"],
      ["check", "--source-root", ".", "--unknown"],
      ["check", "--source-root", ".", "--source-root", "."],
      ["check", "--source-root"],
      ["check", "--source-root", "seed/source"],
    ])
      expect(() => parseProductContractArguments(argv)).toThrow();
  });

  it("retains the canonical target commit and safe merge base without HEAD~1", () => {
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
    ).toEqual({
      targetCommit: "a".repeat(40),
      mergeBase: "b".repeat(40),
    });
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
      `---\nplanSchemaVersion: 1\nproductContract: product.contract.yaml\nworkPackages:\n  - id: WP-REC-001\n    behaviorIds: [BHV-REC-001]\n    appMapTargets: [route:records]\n    work:\n      kind: template-gap\n      target: records\n      templateBacklogRef: AP-001\n      templateResolutionPath: records adapter\n      followUpGates: [check:records]\n      frontend:\n        screenCatalogId: starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx\n        sourceReceipt: docs/template/saas-ui-starter-files.json\n        shellId: app-shell\n        allowedAdaptations: [route-binding, data-adapter]\n        requiredVisualStates: [loading, empty, error, populated, selected, mutation]\nproofs:\n  - behavior: BHV-REC-001\n    behaviorRevision: 1\n    level: black-box\n    surfaces: [web-ui]\n    observation: The record appears.\n    failureWitness: It would be absent.\n---\n# Plan\n`,
    );
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
    const rendered = await readFile(
      join(root, "docs", "template", "generated", "product-contract.md"),
      "utf8",
    );
    expect(rendered).not.toMatch(/verified\s*:/i);
    expect(rendered).toContain("route:records");
    expect(rendered).toContain("tests/acceptance/records.spec.ts");
    expect(
      await readFile(join(root, "product.contract.schema.json"), "utf8"),
    ).toContain("schemaVersion");
    await expect(
      generateProductContract({
        repoRoot: root,
        sourceRoot: ".",
        readAcceptanceReport: async () => ({
          ...reportFor("tests/acceptance/records.spec.ts", root),
          config: {
            ...reportFor("tests/acceptance/records.spec.ts", root).config,
            projects: [
              {
                ...reportFor("tests/acceptance/records.spec.ts", root).config
                  .projects[0],
                testDir: join(root, "tests", "unit"),
              },
            ],
          },
        }),
      }),
    ).rejects.toThrow(/testDir/i);
  });

  it("checks a bounded seed root, preserves stale bytes, and resolves targets per package", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-seed-"));
    const source = join(root, "seed", "source");
    await mkdir(join(source, "docs"), { recursive: true });
    await writeFile(
      join(source, "product.contract.yaml"),
      contractYaml("required"),
    );
    await writeFile(
      join(source, "docs", "records.md"),
      planYaml([
        ["route:records", "template-gap", "records"],
        ["headless:executor", "pattern-instance", "executor"],
        ["unresolved:required", "template-gap", "gap"],
      ]),
    );
    await initGit(root, "seed/source");
    await generateProductContract({
      repoRoot: root,
      sourceRoot: "seed/source",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", source),
    });
    const generatedPath = join(
      source,
      "docs",
      "template",
      "generated",
      "product-contract.md",
    );
    await writeFile(generatedPath, "stale\n");
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: "seed/source",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () =>
          new Set(["route:records", "headless:executor"]),
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", source),
      });
      expect(findings.join("\n")).toMatch(/unresolved:required|stale/i);
      expect(findings.join("\n")).not.toMatch(
        /trusted (?:base has no product contract|product contract is invalid|contract is missing)/i,
      );
      expect(await readFile(generatedPath, "utf8")).toBe("stale\n");
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });

  it("does not let one draft template gap waive another package target", async () => {
    const root = await mkdtemp(join(tmpdir(), "product-contract-gap-"));
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "product.contract.yaml"), contractYaml("draft"));
    await writeFile(
      join(root, "docs", "records.md"),
      planYaml([
        ["unresolved:gap", "template-gap", "gap"],
        ["unresolved:pattern", "pattern-instance", "pattern"],
      ]),
    );
    await initGit(root);
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () => emptyReport(root),
    });
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
        readAcceptanceReport: async () => emptyReport(root),
      });
      expect(findings.join("\n")).toContain(
        "BHV-REC-001 App Map target unresolved:pattern does not resolve",
      );
      expect(findings.join("\n")).not.toContain(
        "BHV-REC-001 App Map target unresolved:gap does not resolve",
      );
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
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
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
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
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", root),
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

  it("rejects a same-revision semantic rewrite in first-contract feature history", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "product-contract-feature-history-"),
    );
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
    writeFileSync(join(root, contractPath), contractYaml("draft"));
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "introduce contract"]);
    writeFileSync(
      join(root, contractPath),
      contractYaml("draft").replace(
        "The member saves a record.",
        "The member deletes a record.",
      ),
    );
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "rewrite contract"]);
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", root),
      });
      expect(findings.join("\n")).toMatch(/semantic edit requires.*revision/i);
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });

  it("rejects an intermediate behavior deletion in first-contract feature history", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "product-contract-intermediate-history-"),
    );
    const git = (args: readonly string[]) =>
      execFileSync("git", [...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      });
    const firstContract = `${contractYaml("draft")}  - id: BHV-REC-002
    revision: 1
    status: draft
    title: A record appears
    actor: workspace member
    surfaces: [web-ui]
    preconditions: []
    action: The member saves a record.
    outcomes: [The record is listed.]
`;
    const secondContract = contractYaml("draft").replace(
      "BHV-REC-001",
      "BHV-REC-002",
    );
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    writeFileSync(join(root, "README.md"), "root\n");
    git(["add", "README.md"]);
    git(["commit", "-qm", "root"]);
    git(["switch", "-q", "-c", "feature"]);
    writeFileSync(join(root, contractPath), firstContract);
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "introduce behaviors"]);
    writeFileSync(join(root, contractPath), secondContract);
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () => emptyReport(root),
    });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "delete behavior"]);
    writeFileSync(join(root, contractPath), firstContract);
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
    git(["add", contractPath, schemaPath, generatedPath]);
    git(["commit", "-qm", "restore behavior"]);
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: root,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", root),
      });
      expect(findings.join("\n")).toMatch(/BHV-REC-001.*deleted|missing/i);
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });

  it("rejects bootstrap from a shallow clone", async () => {
    const source = await mkdtemp(join(tmpdir(), "product-contract-source-"));
    const shallow = await mkdtemp(join(tmpdir(), "product-contract-shallow-"));
    const git = (cwd: string, args: readonly string[]) =>
      execFileSync("git", [...args], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      });
    git(source, ["init", "-q", "-b", "main"]);
    git(source, ["config", "user.email", "test@example.com"]);
    git(source, ["config", "user.name", "Test"]);
    writeFileSync(join(source, "README.md"), "root\n");
    git(source, ["add", "README.md"]);
    git(source, ["commit", "-qm", "root"]);
    writeFileSync(join(source, "README.md"), "base\n");
    git(source, ["add", "README.md"]);
    git(source, ["commit", "-qm", "base"]);
    git(source, ["switch", "-q", "-c", "feature"]);
    writeFileSync(join(source, contractPath), contractYaml("draft"));
    await generateProductContract({
      repoRoot: source,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", source),
    });
    git(source, ["add", contractPath, schemaPath, generatedPath]);
    git(source, ["commit", "-qm", "first contract"]);
    git(source, [
      "clone",
      "-q",
      "--depth=2",
      "--branch",
      "feature",
      `file://${source}`,
      shallow,
    ]);
    git(shallow, [
      "fetch",
      "-q",
      "--depth=1",
      "origin",
      "main:refs/remotes/origin/main",
    ]);
    const previousBranch = process.env.CI_COMMIT_TARGET_BRANCH;
    process.env.CI_COMMIT_TARGET_BRANCH = "main";
    try {
      const findings = await checkProductContract({
        repoRoot: shallow,
        sourceRoot: ".",
        allowFirstContract: true,
        resolveAppMapNodeIds: async () => new Set(),
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", shallow),
      });
      expect(findings.join("\n")).toMatch(/shallow.*bootstrap/i);
    } finally {
      if (previousBranch === undefined)
        delete process.env.CI_COMMIT_TARGET_BRANCH;
      else process.env.CI_COMMIT_TARGET_BRANCH = previousBranch;
    }
  });

  it("rejects stale bootstrap after the target adds and deletes a contract", async () => {
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
    git(["switch", "-q", "-c", "feature"]);
    git(["switch", "-q", "main"]);
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
    git(["switch", "-q", "feature"]);
    writeFileSync(join(root, contractPath), contractYaml);
    await generateProductContract({
      repoRoot: root,
      sourceRoot: ".",
      readAcceptanceReport: async () =>
        reportFor("tests/acceptance/records.spec.ts", root),
    });
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
        readAcceptanceReport: async () =>
          reportFor("tests/acceptance/records.spec.ts", root),
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
