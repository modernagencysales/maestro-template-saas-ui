import {
  resolveCustomerReleasePath,
  type CustomerPathOwnership,
  type CustomerReleasePath,
} from "./manifest";

export class CustomerOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerOwnershipError";
  }
}

const FACTORY_ONLY_PREFIXES = [
  ".agents/",
  ".woodpecker/",
  "tooling/ci/",
  ".claude-plugin/",
  ".claude/",
  ".codex/",
  ".github/",
  ".qlty/",
  ".superpowers/",
  ".vscode/",
  "agent-pack/",
  "apps/voice-relay/",
  "docs/design-intake/",
  "docs/migration/",
  "docs/superpowers/",
  "examples/gtm-context-app/",
  "examples/gtm-implementation/",
  "examples/saas-application/",
  "experiments/",
  "releases/",
  "repos/",
  "tooling/evals/",
  "tooling/pr-backlog/",
  "tooling/release/",
  "tooling/stack/",
] as const;

const FACTORY_ONLY_EXACT = new Set([
  "CLAUDE.md",
  "skills-lock.json",
  "schemas/maestro-customer-release-manifest.schema.json",
  "docs/template/do-not-port-register.md",
  "docs/template/effect-confect-working-plan.md",
  "docs/template/effect-review-findings.md",
  "docs/template/effectification-status.md",
  "docs/template/extraction-redaction-guide.md",
  "docs/template/investor-reviewer-packet.md",
  "docs/template/porting-backlog.md",
  "docs/template/porting-roadmap.md",
  "docs/template/post-port-backlog.md",
  "tooling/app-map/INTEGRATION_REQUEST.md",
  "tooling/release-seal.mts",
  "tooling/release-seal.test.mts",
]);

const FACTORY_ONLY_NESTED_PREFIXES = ["docs/template/extraction/"] as const;

const CUSTOMER_EXTENSION_EXACT = new Set([
  ".env.example",
  "README.md",
  "project.config.json",
  "docs/template/client-intake-questionnaire.md",
]);

const GENERATED_EXACT = new Set([
  ".claude/settings.json",
  "Justfile",
  "package.json",
  "tsconfig.json",
  "apps/web/src/routeTree.gen.ts",
]);

const GENERATED_PREFIXES = ["generated/"] as const;

const TEMPLATE_PREFIXES = [
  "agent-patterns/",
  "apps/cli/",
  "apps/web/",
  "docs/agent/",
  "docs/template/",
  "examples/generic-ai-ops/",
  "patches/",
  "packages/",
  "schemas/",
  "scripts/",
  "tests/",
  "tooling/agent-pack/",
  "tooling/app-map/",
  "tooling/confect-manifest/",
  "tooling/convex-compat/",
  "tooling/effectified-api-proof/",
  "tooling/eslint-plugin-template/",
  "tooling/generators/",
  "tooling/quality/",
  "tooling/workflow/",
] as const;

const TEMPLATE_ROOT_FILES = new Set([
  ".gitignore",
  ".gitleaks.toml",
  ".npmrc",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  "AGENTS.md",
  "convex.json",
  "coverage-baseline.json",
  "dependency-cruiser.config.cjs",
  "docs/rule-coverage.md",
  "eslint.config.mjs",
  "knip.json",
  "lefthook.yml",
  "maestro-template.mjs",
  "playwright.config.ts",
  "playwright.funnel.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "stryker.conf.mjs",
  "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
  "tsconfig.base.json",
  "tsconfig.type-coverage.json",
  "turbo.json",
  "vitest.config.ts",
  "vitest.stryker.config.ts",
]);

const validSourcePath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !path.split("/").includes("..");

const rule = (
  path: string,
  match: "exact" | "subtree",
  ownership: CustomerPathOwnership,
): CustomerReleasePath => {
  if (ownership === "template-owned") {
    return { path, match, ownership, action: "copy", upgrade: "replace" };
  }
  if (ownership === "customer-extension") {
    return { path, match, ownership, action: "copy", upgrade: "preserve" };
  }
  if (ownership === "generated") {
    return {
      path,
      match,
      ownership,
      action: "generate",
      upgrade: "regenerate",
    };
  }
  if (ownership === "local-only") {
    return { path, match, ownership, action: "omit", upgrade: "preserve" };
  }
  return { path, match, ownership, action: "omit", upgrade: "remove" };
};

const subtree = (path: string): string =>
  path.endsWith("/") ? path.slice(0, -1) : path;

export const CUSTOMER_OWNERSHIP_RULES: readonly CustomerReleasePath[] = [
  ...FACTORY_ONLY_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "factory-only"),
  ),
  ...FACTORY_ONLY_NESTED_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "factory-only"),
  ),
  ...[...FACTORY_ONLY_EXACT].map((path) => rule(path, "exact", "factory-only")),
  ...[...CUSTOMER_EXTENSION_EXACT].map((path) =>
    rule(path, "exact", "customer-extension"),
  ),
  ...[...GENERATED_EXACT].map((path) => rule(path, "exact", "generated")),
  ...GENERATED_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "generated"),
  ),
  rule(".env.local", "exact", "local-only"),
  ...TEMPLATE_PREFIXES.map((path) =>
    rule(subtree(path), "subtree", "template-owned"),
  ),
  ...[...TEMPLATE_ROOT_FILES].map((path) =>
    rule(path, "exact", "template-owned"),
  ),
];

export function classifyCustomerSourcePath(
  path: string,
): CustomerReleasePath | undefined {
  if (!validSourcePath(path)) return undefined;
  const ownershipRule = resolveCustomerReleasePath(
    CUSTOMER_OWNERSHIP_RULES,
    path,
  );
  return ownershipRule ? { ...ownershipRule, path, match: "exact" } : undefined;
}

export function buildCustomerOwnershipInventory(
  sourcePaths: readonly string[],
): readonly CustomerReleasePath[] {
  const seen = new Set<string>();
  return [...sourcePaths].sort().map((path) => {
    if (seen.has(path))
      throw new CustomerOwnershipError(`Duplicate source path: ${path}`);
    seen.add(path);
    const entry = classifyCustomerSourcePath(path);
    if (!entry) {
      throw new CustomerOwnershipError(
        `Unclassified customer release source path: ${path}`,
      );
    }
    return entry;
  });
}
