import type { StaticCheckDescriptor } from "./gate.mts";

export const checkDescriptors = {
  "ci-completeness": {
    name: "check:ci-completeness",
    requirements: [
      {
        file: ".buildkite/pipeline.yml",
        includes: [
          "ci-self-protection",
          "pnpm verify",
          "pnpm check:ci-completeness",
          "pnpm check:config-drift",
          "pnpm check:confect-contracts",
          "pnpm check:confect-compat",
          "pnpm check:workflow-graph-boundary",
          "taste",
          "contract-review",
          "staging-deploy",
          "production-promote.sh",
        ],
        message: "Buildkite pipeline must include deterministic and AI gates",
      },
      {
        file: ".buildkite/scripts/ci-self-protection.sh",
        includes: ["check:ci-completeness", "check:config-drift"],
        message: "secretless self-protection step must run the shape pins",
      },
      {
        file: "Justfile",
        includes: ["verify:", "check-fmt:", "lint:", "typecheck:", "test:"],
        message: "Justfile must keep the canonical gate recipe names",
      },
      {
        file: "lefthook.yml",
        includes: ["pre-push", "pre-push-rubric.sh", "check:debt"],
        message: "lefthook must run shifted-left gates and rubric injection",
      },
      {
        file: ".buildkite/scripts/taste.sh",
        includes: [
          "OPENAI_API_KEY",
          "TASTE_PROVIDER",
          "TASTE_OPENROUTER_MODEL",
          "extract-ai-verdict.mts",
          "TASTE_REVIEW_WORKTREE",
          "TRUSTED_TREE",
          "pnpm exec tsx tooling/quality/taste.mts --mode fake | pnpm exec tsx tooling/quality/extract-ai-verdict.mts",
          'pnpm exec tsx "$TRUSTED_TREE/tooling/quality/taste.mts"',
        ],
        message:
          "taste AI gate must require provider auth, run trusted reviewer code, and parse verdicts",
      },
      {
        file: ".buildkite/scripts/contract-review.sh",
        includes: [
          "OPENAI_API_KEY",
          "extract-ai-verdict.mts",
          "CONTRACT_REVIEW_WORKTREE",
          "TRUSTED_TREE",
          "pnpm exec tsx tooling/quality/contract-review.mts --mode fake | pnpm exec tsx tooling/quality/extract-ai-verdict.mts",
          'pnpm exec tsx "$TRUSTED_TREE/tooling/quality/contract-review.mts"',
        ],
        message:
          "contract-review AI gate must require provider auth, run trusted reviewer code, and parse verdicts",
      },
      {
        file: "docs/template/operations-runbook.md",
        includes: [
          "CI And AI Gate Verdicts",
          "buildkite-agent meta-data get staged-sha",
          "tooling/quality/extract-ai-verdict.mts",
          "gh pr checks --watch",
        ],
        message:
          "operations runbook must explain AI gate verdict retrieval and repair workflow",
      },
    ],
  },
  "config-drift": {
    name: "check:config-drift",
    requirements: [
      {
        file: "package.json",
        includes: [
          "check:ci-completeness",
          "check:config-drift",
          "check:confect-v9",
          "check:confect-contracts",
          "check:confect-compat",
          "check:env-boundary",
          "check:provider-boundary",
          "check:logging-boundary",
          "check:access-audit-events",
          "check:workflow-graph-boundary",
          "contract-review",
          "taste:eval",
          "test:mutation",
        ],
        message: "package scripts must expose required quality gates",
      },
      {
        file: ".buildkite/scripts/mutation.sh",
        includes: ["pnpm exec stryker run stryker.conf.mjs"],
        message: "mutation gate must run Stryker in scheduled/manual mode",
      },
      {
        file: "stryker.conf.mjs",
        includes: [
          "@stryker-mutator/vitest-runner",
          "@stryker-mutator/typescript-checker",
          "packages/convex/confect/access/lifecycle.ts",
          "packages/convex/confect/workflows/runGraph.ts",
        ],
        message: "Stryker config must target focused backend primitives",
      },
      {
        file: "project.config.json",
        includes: [
          "maestro-template-staging",
          "maestro-template-production",
          "CLOUDFLARE_API_TOKEN",
          "CONVEX_DEPLOY_KEY",
          "convexUrl",
          "sharedConvexBackendNote",
        ],
        message:
          "project config must declare deploy environments, Convex URLs, required secret names, and any shared-backend exception note",
      },
      {
        file: ".buildkite/scripts/staging-deploy.sh",
        includes: [
          "deploy-doctor staging",
          "scripts/_project-config.mjs get staging cloudflarePagesProject",
          "scripts/_project-config.mjs get staging convexUrl",
          "convex deploy",
          "convex run demo/showcase:seed",
          "pages deploy apps/web/dist/client",
          "buildkite-agent meta-data set staged-sha",
        ],
        message:
          "staging deploy must deploy the Convex backend, bake the Convex URL, deploy the client build, and record the staged SHA",
      },
      {
        file: ".buildkite/scripts/production-promote.sh",
        includes: [
          "deploy-doctor production",
          "promote-plan",
          "scripts/_project-config.mjs get production convexUrl",
          "convex deploy",
          "convex run demo/showcase:seed",
          "pages deploy apps/web/dist/client",
          "buildkite-agent meta-data get staged-sha",
        ],
        message:
          "production promote must deploy the Convex backend, bake the Convex URL, deploy the client build, and verify the staged SHA",
      },
    ],
  },
  deps: {
    name: "check:deps",
    requirements: [
      {
        file: "package.json",
        includes: ["pnpm@10.12.1", "turbo", "typescript"],
        message: "root package metadata must pin core tooling",
      },
      {
        file: "pnpm-lock.yaml",
        includes: ["lockfileVersion"],
        message: "lockfile must exist",
      },
    ],
  },
  knip: {
    name: "check:knip",
    requirements: [
      {
        file: "knip.json",
        includes: ["entry", "project"],
        message: "knip must have a real workspace-aware config",
      },
      {
        file: "package.json",
        includes: ["knip --config knip.json"],
        message: "check:knip must invoke the real knip CLI",
      },
    ],
  },
  "route-tree": {
    name: "check:route-tree",
    requirements: [
      {
        file: "docs/template/repo-map.md",
        includes: [
          "/brain",
          "/workflows",
          "/capabilities",
          "/agents",
          "/runs",
          "/settings",
          "/api",
          "/admin",
        ],
        message: "repo map must declare planned app routes",
      },
      {
        file: "docs/template/frontend-architecture.md",
        includes: [
          "generated `routeTree`",
          'defaultPreload: "intent"',
          "scrollRestoration: true",
          "apps/web/src/routeTree.gen.ts",
        ],
        message:
          "frontend architecture must declare TanStack Start route tree invariants",
      },
      {
        file: "apps/web/package.json",
        includes: [
          '"@tanstack/react-start"',
          '"@tanstack/react-router"',
          '"@tanstack/react-query"',
          '"@convex-dev/react-query"',
          '"@workos/authkit-tanstack-react-start"',
          '"@saas-ui/react"',
          '"@saas-ui-pro/react"',
        ],
        message:
          "web package must include the committed TanStack Start and Saas UI runtime dependencies",
      },
    ],
  },
  "types-coverage": {
    name: "check:types-coverage",
    requirements: [
      {
        file: "tsconfig.base.json",
        includes: [
          "strict",
          "noUncheckedIndexedAccess",
          "exactOptionalPropertyTypes",
        ],
        message: "TypeScript config must enforce strict typing",
      },
      {
        file: "package.json",
        includes: [
          "type-coverage --project tsconfig.type-coverage.json --at-least 99.7",
        ],
        message:
          "check:types-coverage must invoke type-coverage with an explicit threshold",
      },
      {
        file: "tsconfig.type-coverage.json",
        includes: ["include", "exclude"],
        message: "type coverage must inspect real project files",
      },
      {
        file: "docs/template/type-coverage-ratchet.md",
        includes: ["99.7", "100%"],
        message:
          "type coverage ratchet must be documented until it reaches 100%",
      },
    ],
  },
  gates: {
    name: "check:gates",
    requirements: [
      {
        file: "tooling/quality/src/gate.mts",
        includes: ["evaluateStaticCheck", "runStaticCheck"],
        message: "quality gate harness must exist",
      },
      {
        file: "package.json",
        includes: ["check:gates"],
        message: "gate scripts must be reachable from package.json",
      },
    ],
  },
  debt: {
    name: "check:debt",
    requirements: [
      {
        file: "docs/template/coding-standards.md",
        includes: ["No `any`", "Generated files are never edited directly"],
        message: "coding standards must encode debt-prevention rules",
      },
    ],
  },
  generators: {
    name: "check:generators (shape-only)",
    requirements: [
      {
        file: "docs/template/app-factory-guide.md",
        includes: [
          "template:quickstart",
          "template:init",
          "template:add-client-domain",
          "blueprint-catalog.md",
          "generator-output-contract.md",
        ],
        message: "app factory guide must document generator workflow",
      },
      {
        file: "docs/template/blueprint-catalog.md",
        includes: [
          "source-grounded-gtm-brain",
          "implementation-consulting-brain",
          "internal-ops-agent-workspace",
          "custom-domain-ai-app",
        ],
        message: "blueprint catalog must document core factory blueprints",
      },
      {
        file: "docs/template/generator-output-contract.md",
        includes: [
          "Confect spec/impl",
          "Effect schema",
          "typed errors",
          "generated manifest/headless metadata",
          "explicit generated ref mappings",
        ],
        absent: ["headless registry entry"],
        message: "generator output contract must protect generated slices",
      },
      {
        file: "docs/template/client-handoff-packet.md",
        includes: ["real", "fake", "seam", "planned", "Required secret names"],
        message: "handoff packet must define status labels and secret posture",
      },
      {
        file: "package.json",
        includes: [
          "template:quickstart",
          "template:seed-demo",
          "template:handoff",
          "template:add-client-domain",
        ],
        message: "package scripts must expose app factory quickstart commands",
      },
    ],
  },
  "docs-freshness": {
    name: "check:docs-freshness",
    requirements: [
      {
        file: "README.md",
        includes: [
          "AGENTS.md",
          "repo-map.md",
          "reviewer-guide.md",
          "delivery-receipts.md",
        ],
        message: "README must link primary navigation docs",
      },
      {
        file: "docs/template/env-manifest.md",
        includes: [
          "WorkOS",
          "PostHog",
          "Dodo",
          "MailerSend",
          "OpenRouter",
          "Cloudflare",
          "Buildkite",
          "fake mode",
          "rotation",
        ],
        message:
          "env manifest must document provider setup, fake-mode behavior, and rotation posture",
      },
      {
        file: ".env.example",
        includes: ["example.test", "fake_local_key", "acme-demo"],
        message:
          ".env.example must expose safe fake values for local quickstart",
      },
    ],
  },
  "generated-files": {
    name: "check:generated-files",
    requirements: [
      {
        file: "AGENTS.md",
        includes: ["Do not edit generated Confect or Convex files by hand"],
        message: "agent instructions must protect generated files",
      },
    ],
  },
  "confect-contracts": {
    name: "check:confect-contracts",
    requirements: [
      {
        file: "docs/template/confect-effect-guide.md",
        includes: [
          "Schema.Null",
          "import type",
          "GroupImpl.finalize",
          "confect/auth.ts",
          "confect/crons.ts",
          "confect/http.ts",
        ],
        message: "Confect guide must encode contract invariants",
      },
      {
        file: "packages/convex/confect/capabilities/catalog.spec.ts",
        includes: [
          "FunctionSpec.publicQuery",
          "Schema.Struct",
          "Schema.Array",
          "GroupSpec.make().addFunction",
        ],
        message: "capability catalog must be a Confect/Effect spec",
      },
      {
        file: "packages/convex/confect/brain/pages.spec.ts",
        includes: [
          "FunctionSpec.publicQuery",
          "FunctionSpec.publicMutation",
          "WorkspaceNotFound",
          "brainPages.Doc",
        ],
        message: "Brain pages must expose typed Confect contracts",
      },
      {
        file: "packages/convex/confect/jobs/workpool.spec.ts",
        includes: [
          "import type",
          "FunctionSpec.convexPublicMutation",
          "FunctionSpec.convexPublicQuery",
          "FunctionSpec.convexInternalAction",
          "FunctionSpec.convexInternalMutation",
        ],
        message:
          "plain Convex component functions must be type-only in Confect specs",
      },
      {
        file: "packages/convex/confect/jobs/workpool.impl.ts",
        includes: ["FunctionImpl.make", "GroupImpl.finalize"],
        message: "plain Convex component impls must finalize through Confect",
      },
      {
        file: "packages/convex/confect/_generated/refs.ts",
        includes: ["Refs.FromSpec", "Refs.make(spec)"],
        message: "generated Confect refs must be present",
      },
      {
        file: "packages/convex/confect/_generated/spec.ts",
        includes: ["capabilities", "brain", "jobs", "workpool"],
        message: "generated Confect spec must include core template groups",
      },
      {
        file: "tooling/quality/check-confect-contracts.mts",
        includes: [
          "publicSpecMissingError",
          "ambientDateNow",
          "plainConvexValueImports",
          "requiredGeneratedFilesMissing",
          "collectConfectContractFindings",
        ],
        message:
          "Confect contract gate must keep semantic contract scanners wired",
      },
    ],
  },
  "confect-compat": {
    name: "check:confect-compat",
    requirements: [
      {
        file: "docs/template/confect-effect-guide.md",
        includes: [
          "@confect/server",
          "9.1.5",
          "effect",
          "3.21.4",
          "@effect/platform-node",
          "0.106.0",
          "convex-test",
          "0.0.54",
          "check:confect-compat",
        ],
        message:
          "Confect guide must record the resolved compatible package matrix",
      },
      {
        file: "packages/convex/package.json",
        includes: [
          '"@confect/core": "9.1.5"',
          '"@confect/server": "9.1.5"',
          '"@confect/test": "9.1.5"',
          '"@effect/platform-node": "0.106.0"',
          '"convex-test": "0.0.54"',
          '"confect:codegen"',
          '"check:convex"',
        ],
        message:
          "Convex package must pin Confect-compatible runtime and codegen scripts",
      },
      {
        file: "apps/web/package.json",
        includes: [
          '"@confect/react": "9.1.5"',
          '"effect": "3.21.4"',
          '"convex": "1.42.1"',
        ],
        message: "web package must pin the Confect React client set",
      },
      {
        file: "apps/cli/package.json",
        includes: [
          '"@confect/js": "9.1.5"',
          '"@effect/platform-node": "0.106.0"',
          '"effect": "3.21.4"',
        ],
        message: "CLI package must pin the Confect JavaScript client set",
      },
    ],
  },
  "schema-migration-notes": {
    name: "check:schema-migration-notes",
    requirements: [
      {
        file: "docs/template/data-lifecycle.md",
        includes: [
          "owner module",
          "retention",
          "export posture",
          "delete posture",
        ],
        message: "data lifecycle docs must require schema metadata",
      },
    ],
  },
  "layer-boundaries": {
    name: "check:layer-boundaries",
    requirements: [
      {
        file: "dependency-cruiser.config.cjs",
        includes: ["forbidden", "from", "to"],
        message: "dependency-cruiser config must enforce layer boundaries",
      },
      {
        file: "package.json",
        includes: ["depcruise --config dependency-cruiser.config.cjs"],
        message:
          "check:layer-boundaries must invoke dependency-cruiser instead of a placeholder check",
      },
    ],
  },
  "secret-canaries": {
    name: "check:secret-canaries",
    requirements: [
      {
        file: ".gitleaks.toml",
        includes: ["generic-api-key", "regex"],
        message: "gitleaks config must include a generic secret rule",
      },
      {
        file: "package.json",
        includes: ["gitleaks detect --config .gitleaks.toml"],
        message: "check:secret-canaries must run gitleaks",
      },
      {
        file: "docs/template/security.md",
        includes: ["Secrets never enter client bundles", "Logs redact secrets"],
        message: "security docs must define secret boundaries",
      },
    ],
  },
  "sbom-license": {
    name: "check:sbom-license",
    requirements: [
      {
        file: "docs/template/extraction/dependency-license-inventory.md",
        includes: ["Dependency And License Inventory", "Private Artifact Rule"],
        message: "dependency/license inventory must exist",
      },
    ],
  },
  "headless-surface-contract": {
    name: "check:headless-surface-contract",
    requirements: [
      {
        file: "README.md",
        includes: ["API/CLI/MCP -> headless registry"],
        message: "architecture docs must include headless projection",
      },
      {
        file: "tooling/quality/check-headless-surface-contract.mts",
        includes: [
          "missingTypedErrors",
          "cannedRegistryImport",
          "cannedRuntimeSuccess",
          "missingGeneratedRefMapping",
          "evaluateHeadlessSurfaceContract",
        ],
        message:
          "headless surface gate must run semantic generated parity checks",
      },
    ],
  },
  "posthog-readiness": {
    name: "check:posthog-readiness",
    requirements: [
      {
        file: "docs/template/integrations.md",
        includes: [
          "PostHog backend capture covers Confect mutation and action failures only",
          "functionPath",
          "kind",
          "public error tag",
          "redacted public message",
          "stable cause hash",
          "Query",
          "capture is not included",
        ],
        message:
          "integrations docs must define PostHog backend Confect failure capture and query limitation",
      },
      {
        file: ".env.example",
        includes: [
          "POSTHOG_PROJECT_TOKEN=phc_test_placeholder",
          "POSTHOG_HOST=http://localhost",
        ],
        absent: ["POSTHOG_KEY", "POSTHOG_DISABLED"],
        message:
          ".env.example must use PostHog Convex component env names and fake/test placeholders",
      },
      {
        file: "packages/integrations/src/index.ts",
        includes: ['requiredEnv: ["POSTHOG_PROJECT_TOKEN", "POSTHOG_HOST"]'],
        absent: ['requiredEnv: ["POSTHOG_KEY", "POSTHOG_HOST"]'],
        message:
          "provider descriptors must use the PostHog Convex component project token env",
      },
      {
        file: "tooling/generators/src/index.ts",
        includes: [
          "envManifestPath",
          "readEnvManifest",
          'posthog: "posthog"',
          "requiredEnvNamesForProvider",
        ],
        absent: ['posthog: ["POSTHOG_KEY", "POSTHOG_HOST"]'],
        message:
          "template generator required secrets must be loaded from the env manifest with the PostHog project token group",
      },
      {
        file: "tooling/generators/src/index.test.ts",
        includes: [
          'requiredEnvNamesForProvider("posthog")',
          '"POSTHOG_HOST"',
          '"POSTHOG_PROJECT_TOKEN"',
        ],
        absent: ['"POSTHOG_KEY"'],
        message:
          "template generator tests must prove PostHog live env names come from the env manifest",
      },
      {
        file: "docs/template/env-manifest.md",
        includes: [
          "POSTHOG_PROJECT_TOKEN",
          "phc_test_placeholder",
          "POSTHOG_HOST=http://localhost",
          "local checks never require live credentials",
        ],
        message:
          "env manifest must document fake/test PostHog placeholders without live credentials",
      },
      {
        file: "docs/template/confect-effect-guide.md",
        includes: [
          'withMutationErrorCapture("brain/pages.createMarkdown", effect)',
          'withActionErrorCapture("group/functionName", effect)',
          "preserves and",
          "re-fails the original cause",
          "There is no `withQueryErrorCapture` helper",
        ],
        message:
          "Confect guide must document PostHog error-capture wrapper usage and limitations",
      },
      {
        file: "docs/template/effectification-status.md",
        includes: [
          "brain/pages.createMarkdown",
          "Remaining Confect groups are still unwrapped pending rollout/factory support",
        ],
        message:
          "effectification status must identify the first wrapped group and remaining rollout gap",
      },
      {
        file: "tooling/effectified-api-proof/posthog-proof.ts",
        includes: [
          'import { PostHog } from "@posthog/convex"',
          "new PostHog(component)",
          "posthog.capture",
          "template.proof",
        ],
        message:
          "PostHog API proof must exercise constructor and capture shape",
      },
      {
        file: "packages/convex/convex/convex.config.ts",
        includes: [
          'import posthog from "@posthog/convex/convex.config.js"',
          "POSTHOG_PROJECT_TOKEN: v.string()",
          "POSTHOG_HOST: v.optional(v.string())",
          "app.use(posthog",
        ],
        message:
          "Convex config must mount the PostHog component with token and optional host env",
      },
      {
        file: "packages/observability/src/index.ts",
        includes: [
          "CapturedConfectFailure",
          "template.confect.failure",
          "functionPath",
          "kind",
          "errorTag",
          "errorMessage",
          "causeHash",
          "redactObservabilityPayload",
        ],
        message:
          "observability package must expose the redacted Confect failure event contract",
      },
      {
        file: "packages/convex/confect/observability/errorCapture.ts",
        includes: [
          "withMutationErrorCapture",
          "withActionErrorCapture",
          "Effect.catchAllCause",
          "Effect.catchAll(() => Effect.void)",
          "Effect.failCause(cause)",
        ],
        message:
          "Confect error-capture wrappers must best-effort capture and preserve the original cause",
      },
      {
        file: "packages/convex/confect/brain/pages.impl.ts",
        includes: ["withMutationErrorCapture", "brain/pages.createMarkdown"],
        message:
          "brain/pages.createMarkdown must be the first wrapped Confect mutation",
      },
    ],
  },
  "auth-demo-bypass": {
    name: "check:auth-demo-bypass",
    requirements: [
      {
        file: "docs/template/security.md",
        includes: ["No caller-supplied tenant identity"],
        message: "security docs must forbid demo auth bypasses",
      },
    ],
  },
  "workflow-graph-boundary": {
    name: "check:workflow-graph-boundary (shape-only)",
    requirements: [
      {
        file: "packages/workflow-ui/src/index.tsx",
        includes: ["@xyflow/react", "ReactFlow", "WorkflowCanvas"],
        message: "workflow UI package must own React Flow canvas rendering",
      },
      {
        file: "packages/template-core/src/index.ts",
        includes: ["workflow", "nodes", "edges"],
        absent: ["@xyflow/react", "ReactFlow"],
        message:
          "durable workflow registry must not depend on React Flow runtime",
      },
      {
        file: "tooling/workflow/src/index.ts",
        includes: ["generatedMcpOperationRefs", "buildGeneratedMcpTools"],
        absent: ["@xyflow/react", "ReactFlow"],
        message:
          "headless workflow projection entrypoint must not depend on React Flow runtime",
      },
      {
        file: "tooling/workflow/src/workflow-compat.ts",
        includes: ["createSampleWorkflowRunReceipt"],
        absent: ["@xyflow/react", "ReactFlow"],
        message:
          "headless workflow projection must not depend on React Flow runtime",
      },
    ],
  },
} satisfies Record<string, StaticCheckDescriptor>;

export type CheckName = keyof typeof checkDescriptors;

export function descriptorFor(name: CheckName): StaticCheckDescriptor {
  return checkDescriptors[name];
}
