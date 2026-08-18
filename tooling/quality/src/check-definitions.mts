import type {
  RegisteredStaticCheckDescriptor,
  StaticCheckDescriptor,
  StaticCheckDiagnosticMetadata,
} from "./gate.mts";

const checkDescriptorDefinitions = {
  "ci-completeness": {
    name: "check:ci-completeness",
    requirements: [
      {
        file: ".woodpecker/firewall.yml",
        includes: [
          "trusted-ci-policy",
          "node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a",
          "tooling/ci/ci-self-protection.sh",
          "tooling/ci/firewall.sh",
          "class: firewall",
          "depends_on:",
        ],
        message:
          "Woodpecker PR firewall must route through trusted deterministic CI scripts",
      },
      {
        file: ".woodpecker/epoch.yml",
        includes: ["class: epoch", "event: manual", "tooling/ci/epoch.sh"],
        message: "Woodpecker full verification must run only as a manual epoch",
      },
      {
        file: ".woodpecker/verify.yml",
        includes: [
          "event: pull_request",
          "node:22.23.2-bookworm@sha256:",
          "depth: 1",
          "verify-core",
          "verify-coverage",
          "status: [success, failure]",
          "node tooling/ci/verify-aggregate.mjs",
        ],
        message:
          "the required Woodpecker PR context must aggregate both isolated verification workflows",
      },
      {
        file: ".woodpecker/verify-core.yml",
        includes: [
          "event: pull_request",
          "node:22.23.2-bookworm@sha256:",
          "apt-get install -y --no-install-recommends strace",
          "tooling/ci/verify-chassis.sh",
        ],
        message:
          "core verification must run through the pinned secretless verification chassis",
      },
      {
        file: ".woodpecker/verify-coverage.yml",
        includes: [
          "event: pull_request",
          "node:22.23.2-bookworm@sha256:",
          "tooling/ci/verify-coverage.sh",
        ],
        message:
          "coverage verification must run in its own pinned secretless workflow",
      },
      {
        file: "tooling/ci/verify-chassis.sh",
        includes: [
          "bash tooling/ci/install-gitleaks.sh",
          'export PATH="${HOME}/.local/bin:${PATH}"',
          "pnpm verify:without-coverage",
        ],
        absent: [
          "install-gitleaks.sh || true",
          "if ! bash tooling/ci/install-gitleaks.sh",
          "pnpm --dir tooling/agent-pack test:customer",
          "pnpm --dir tooling/generators test",
          "pnpm --dir tooling/release test",
          "pnpm --dir apps/cli test:create-root-admission",
          "pnpm --dir apps/cli test:create-root-integration",
          "pnpm --dir apps/web typecheck",
          "pnpm --dir apps/web build",
          "pnpm --dir apps/web test:runtime-longevity",
        ],
        message:
          "the required Woodpecker PR context must reach root verification once without nested suite reruns",
      },
      {
        file: "tooling/ci/firewall.sh",
        includes: [
          "pnpm check:format",
          "pnpm lint",
          "pnpm typecheck",
          "pnpm check:deps",
          "pnpm check:layer-boundaries",
          "pnpm check:secret-canaries",
          "if ! bash tooling/ci/install-qlty.sh",
          "pnpm check:qlty -- --diff",
        ],
        absent: ["pnpm verify", "pnpm acceptance:"],
        message:
          "PR firewall must enforce its fast deterministic and advisory gates without nested acceptance",
      },
      {
        file: "tooling/ci/epoch.sh",
        includes: [
          "FACTORY_EPOCH_SHA",
          "if ! bash tooling/ci/install-qlty.sh",
          "pnpm check:qlty -- --all",
          "pnpm verify",
        ],
        absent: ["pnpm acceptance:"],
        message: "manual epochs must bind exact SHA and run full verification",
      },
      {
        file: ".woodpecker/deploy.yml",
        includes: [
          "staging-deploy",
          "production-promote",
          'CI_PIPELINE_DEPLOY_TARGET == "staging"',
          'CI_PIPELINE_DEPLOY_TARGET == "production"',
          "tooling/ci/staging-deploy.sh",
          "tooling/ci/production-promote.sh",
        ],
        message:
          "Woodpecker deployment pipeline must isolate staging and production",
      },
      {
        file: ".github/CODEOWNERS",
        includes: [
          "/docs/template/system-catalog*",
          "/docs/template/product-topology*",
          "/docs/template/data-resources.json",
          "/tooling/quality/",
          "/tooling/generators/",
          "/tooling/ci/",
          "/packages/template-core/",
          "/apps/web/",
          "/apps/cli/",
          "/packages/convex/",
          "/examples/saas-application/",
          "@timkeeeeeen",
        ],
        absent: ["\n* @", "@kimprobably"],
        message:
          "code-owner review must protect trust, contract, and product roots",
      },
      {
        file: "tooling/ci/ci-self-protection.sh",
        includes: [
          "check:ci-completeness",
          "check:deploy-authority",
          "check:config-drift",
          "check:convex-ai-files",
          "check:agent-pack",
          "check:app-map",
          "check:workflow-semantics",
        ],
        message: "secretless self-protection step must run the shape pins",
      },
      {
        file: "tooling/release/deploy-trust-bundle.json",
        includes: [
          "tooling/quality/check-deploy-authority.mts",
          "tooling/release/deploy-policy.json",
          "tooling/release/keys/deploy-authority-public-key.pem",
        ],
        message:
          "deploy trust bundle must cover verifier, policy, and public key",
      },
      {
        file: "tooling/release/deploy-policy.json",
        includes: [
          "tooling/release/src/deploy/guardedDeploy.ts",
          "staging-authority-preflight",
          "production-authority-preflight",
          "TEMPLATE_CONVEX_DEPLOY_KEY",
        ],
        message:
          "deploy policy must pin the guarded primitive owner, preflights, and credential scope",
      },
      {
        file: "tooling/ci/phase1.sh",
        includes: ["pnpm verify", "pnpm template:workflow-output-smoke"],
        absent: [
          "pnpm acceptance:",
          "pnpm check:system-catalog",
          "pnpm check:system-topology",
          "pnpm check:data-resources",
          "pnpm check:append-only-tables",
          "pnpm check:promotion-boundary",
          "pnpm check:workflow-semantics",
          "pnpm check:convex-ai-files",
          "pnpm check:agent-pack",
          "pnpm check:app-map",
        ],
        message:
          "hosted deterministic CI must delegate the complete gate sequence to root verify exactly once",
      },
      {
        file: "lefthook.yml",
        includes: [
          "pnpm prettier --write {staged_files}",
          "ESLINT_SHIFT_LEFT=1 pnpm eslint {staged_files}",
          "pnpm check:qlty -- --staged",
        ],
        absent: [
          "pre-push-rubric.sh",
          "pnpm typecheck",
          "pnpm test",
          "check:workflow",
          "check:system",
          "check:data-resources",
          "check:append-only-tables",
          "check:promotion-boundary",
          "acceptance:",
        ],
        message:
          "lefthook must keep staged hygiene fast and leave broad admission to Woodpecker",
      },
      {
        file: "package.json",
        includes: [
          '"verify"',
          '"typecheck": "turbo run typecheck --concurrency=1 --filter=!@workspace/ui --filter=!@maestro-template/web && pnpm typecheck:saas-ui"',
          '"test:release-filesystem"',
          '"test:verify-uncovered"',
          '"test:heavyweight-customer-artifacts": "node tooling/ci/run-heavyweight-suites.mjs"',
          '"verify:without-coverage"',
          '"test:app-map"',
          '"check:agent-pack": "tsx tooling/agent-pack/src/syncSkills.ts && tsx tooling/quality/check-agent-pack.mts"',
          '"check:app-map": "pnpm --dir tooling/app-map check"',
          '"check:confect-manifest": "tsx tooling/confect-manifest/src/check.ts"',
          "--exclude apps/cli/src/factory/customerCliRuntime.test.ts",
          "--exclude apps/cli/src/factory/createRootIntegration.test.ts",
          "--exclude tooling/release/src/customerTarget/finalFilesystem.test.ts",
          "pnpm test:bootstrap && turbo run test --filter=!@maestro-template/release-tooling --filter=!@maestro-template/agent-pack --filter=!@maestro-template/cli --filter=!@maestro-template/convex-compat && pnpm --dir tooling/agent-pack test && pnpm --dir apps/cli test && pnpm --dir tooling/convex-compat test && pnpm --dir packages/convex test:workflow-conformance && pnpm --dir apps/cli test:customer-cli-runtime && pnpm --dir apps/cli test:create-root-integration && pnpm --dir tooling/agent-pack test:privacy-no-network && pnpm --dir tooling/release test:unit && pnpm test:release-filesystem",
          "pnpm test:bootstrap && pnpm --dir packages/app-idea-evaluator test && pnpm --dir packages/editor-core test && pnpm --dir packages/editor-react test && pnpm --dir packages/workflow-ui test && pnpm --dir tooling/agent-pack test && pnpm --dir tooling/evals test && pnpm --dir tooling/convex-compat test && pnpm --dir tooling/app-map test && pnpm --dir tooling/eslint-plugin-template test && pnpm --dir tooling/confect-manifest test && pnpm test:chassis-ci && pnpm test:heavyweight-customer-artifacts && pnpm test:acceptance-tooling",
          'pnpm --dir tooling/evals test && pnpm --dir tooling/release test:unit"',
          "pnpm check:agent-pack && pnpm check:deps",
          "pnpm check:schema-migration-notes && pnpm check:system-catalog && pnpm check:system-topology && pnpm check:data-resources && pnpm check:append-only-tables && pnpm check:promotion-boundary && pnpm check:layer-boundaries",
        ],
        message:
          "the root verify chain must run heavyweight proofs once and canonical system/schema ownership before layer checks",
      },
      {
        file: "tooling/ci/run-heavyweight-suites.mjs",
        includes: [
          '["--dir", "apps/cli", "test:customer-cli-runtime"]',
          '["test:release-filesystem"]',
          '["--dir", "apps/cli", "test:create-root-integration"]',
          '["--dir", "tooling/agent-pack", "test:privacy-no-network"]',
          "Promise.all(",
          'process.on("SIGINT", onInterrupt)',
          'process.on("SIGTERM", onTerminate)',
        ],
        message:
          "heavyweight customer-artifact proofs must use two serial lanes with aggregate results and signal forwarding",
      },
      {
        file: "tooling/ci/verify-coverage.sh",
        includes: [
          "source tooling/ci/setup.sh",
          "bash tooling/ci/install-gitleaks.sh",
          "pnpm exec playwright install --with-deps chromium",
          "pnpm check:coverage-ratchet",
        ],
        absent: ["strace", "pnpm verify"],
        message:
          "isolated coverage verification must install the tools exercised by its tests without syscall tracing",
      },
      {
        file: "tooling/ci/verify-aggregate.mjs",
        includes: [
          '"verify-core"',
          '"verify-coverage"',
          "CI_PIPELINE_URL",
          "pipeline.workflows",
          '!== "success"',
        ],
        message:
          "the required aggregate context must fail closed against Woodpecker dependency states",
      },
      {
        file: "apps/cli/package.json",
        includes: [
          "--exclude src/factory/createRootIntegration.test.ts",
          "--exclude src/factory/customerCliRuntime.test.ts",
          "vitest run src/factory/customerCliRuntime.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism",
          "vitest run src/factory/createRootIntegration.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism",
        ],
        message:
          "heavyweight customer integration proofs must run exactly once in dedicated serial CLI gates",
      },
      {
        file: "packages/convex/package.json",
        includes: [
          "--exclude test/workflow-conformance.test.ts",
          "vitest run test/workflow-conformance.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism",
        ],
        message:
          "workflow conformance must run exactly once outside the Turbo-wide resource wave",
      },
      {
        file: "tooling/agent-pack/package.json",
        includes: [
          "--exclude src/privacy/privacy.noNetwork.test.ts",
          "vitest run src/privacy/privacy.noNetwork.test.ts --maxWorkers=1 --no-file-parallelism",
        ],
        message:
          "the heavyweight no-network proof must run exactly once in a dedicated serial agent-pack gate",
      },
      {
        file: "tooling/generators/package.json",
        includes: [
          '"test": "vitest run --passWithNoTests --pool=threads --maxWorkers=1 --no-file-parallelism"',
        ],
        message:
          "generator tests that exercise checked-out projections must run without file parallelism",
      },
      {
        file: "tooling/release/package.json",
        includes: [
          '"test": "pnpm test:unit && pnpm test:final-filesystem"',
          "--exclude src/customerTarget/finalFilesystem.test.ts",
          "vitest run src/customerTarget/finalFilesystem.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism",
        ],
        message:
          "the heavyweight customer filesystem proof must run exactly once in a dedicated serial release gate",
      },
      {
        file: "tooling/ci/taste.sh",
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
        file: "tooling/ci/contract-review.sh",
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
          "woodpecker-cli pipeline log show",
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
          "check:convex-ai-files",
          "check:agent-pack",
          "check:confect-effect-compat",
          "check:confect-contracts",
          "check:confect-compat",
          "check:env-boundary",
          "check:provider-boundary",
          "check:logging-boundary",
          "check:access-audit-events",
          "check:system-catalog",
          "check:system-topology",
          "check:data-resources",
          "check:promotion-boundary",
          "check:workflow-graph-boundary",
          "check:workflow-semantics",
          "contract-review",
          "taste:eval",
          "test:mutation",
        ],
        message: "package scripts must expose required quality gates",
      },
      {
        file: "tooling/ci/mutation.sh",
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
          "perfect-sparrow-808",
          "hearty-peccary-962",
          "CLOUDFLARE_API_TOKEN",
          "CONVEX_DEPLOY_KEY",
          "convexUrl",
          "sharedConvexBackendNote",
        ],
        message:
          "project config must declare deploy environments, Convex URLs, required secret names, and any shared-backend exception note",
      },
      {
        file: "tooling/ci/staging-deploy.sh",
        includes: [
          "deploy-doctor staging",
          "scripts/_project-config.mjs get staging cloudflarePagesProject",
          "scripts/_project-config.mjs get staging convexUrl",
          "guardedDeploy.ts convex",
          "convex run demo/showcase:seed",
          "guardedDeploy.ts cloudflare",
          "check-deploy-authority-receipt.mts record",
        ],
        message:
          "staging deploy must deploy the Convex backend, bake the Convex URL, deploy the client build, and record the staged SHA",
      },
      {
        file: "tooling/ci/production-promote.sh",
        includes: [
          "deploy-doctor production",
          "promote-plan",
          "scripts/_project-config.mjs get production convexUrl",
          "guardedDeploy.ts convex",
          "convex run demo/showcase:seed",
          "guardedDeploy.ts cloudflare",
          'STAGED_SHA="${STAGED_SHA:?STAGED_SHA is required}"',
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
          "apps/web/src/routes/_app/",
          "workspace dashboard",
          "contacts",
          "inbox",
          "search",
          "getting-started",
          "settings",
        ],
        message: "repo map must declare the literal Starter route authority",
      },
      {
        file: "docs/template/frontend-architecture.md",
        includes: [
          "generated `routeTree`",
          'defaultPreload: "intent"',
          "setupRouterSsrQueryIntegration",
          "apps/web/src/routeTree.gen.ts",
        ],
        message:
          "frontend architecture must declare TanStack Start route tree invariants",
      },
      {
        file: "apps/web/src/router.tsx",
        includes: [
          "routeTree",
          'defaultPreload: "intent"',
          "setupRouterSsrQueryIntegration",
        ],
        message: "web router must preserve the pinned Starter route behavior",
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
        file: "package.json",
        includes: ["tsx tooling/quality/run-type-coverage.mts"],
        message:
          "check:types-coverage must invoke the receipt-aware type-coverage runner",
      },
      {
        file: "tooling/quality/run-type-coverage.mts",
        includes: [
          'import.meta.resolve("type-coverage/bin/type-coverage")',
          "--max-old-space-size=8192",
          "--at-least",
          '"99.7"',
          "--ignore-files",
          "verifiedImmutableReceiptPaths",
        ],
        message:
          "type-coverage must keep its threshold and derive exact receipt ignores",
      },
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
        file: "tsconfig.type-coverage.json",
        includes: [
          "include",
          "exclude",
          "**/*.test.*",
          "**/*.spec.*",
          "**/__tests__/**",
          "packages/convex/test/**",
          "tests/**",
          "tooling/agent-pack/evals/runs/**",
        ],
        message:
          "type coverage must inspect source while excluding generated eval workspaces and test files",
      },
      {
        file: "docs/template/type-coverage-ratchet.md",
        includes: ["99.7", "100%", "source-only", "strict TypeScript"],
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
          "template:prototype",
          "template:add-feature",
          "blueprint-catalog.md",
          "generator-output-contract.md",
          "system-catalog.md",
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
          "canonical system ID",
          "--disposition",
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
          "template:systems",
          "template:prototype",
          "template:add-feature",
          "check:system-catalog",
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
          "Postmark",
          "OpenRouter",
          "Cloudflare",
          "Woodpecker",
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
      {
        file: "AGENTS.md",
        includes: [
          "docs/template/saas-ui-frontend-authority.md",
          "docs/template/saas-ui-golden-review.md",
        ],
        message:
          "agent guidance must point to the upstream-derived frontend authority",
      },
      {
        file: "docs/template/saas-ui-upstream-update.md",
        includes: [
          "Pin the reviewed template",
          "Regenerate the Pro catalog",
          "ci/woodpecker/pr/verify",
        ],
        message:
          "upstream update docs must preserve the pinned evidence workflow",
      },
      {
        file: "docs/template/saas-ui-golden-review.md",
        includes: [
          "UPSTREAM_REFERENCE_URL",
          "GOLDEN_GENERATED_URL",
          "keyboard-only",
          "320 px",
          "Approved: pinned reference and generated target",
        ],
        message:
          "golden review docs must require paired browser evidence and owner approval",
      },
      {
        file: ".github/pull_request_template.md",
        includes: [
          "Upstream source file or Pro block",
          "Deviation ledger entry",
          "Desktop/mobile light/dark evidence",
          "Accessibility results",
        ],
        message:
          "PRs must capture upstream mapping, deviations, and rendered evidence",
      },
      {
        file: "docs/template/saas-ui-frontend-authority.md",
        includes: [
          "pinned TanStack Starter",
          "Kit Pro",
          "pinned Saas UI Pro",
          "must not enter a public npm package",
        ],
        message:
          "frontend authority must keep paid Starter and Pro source private",
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
      {
        file: "tooling/quality/check-saas-ui-artifact-safety.mts",
        includes: ["assertSaasUiArtifactSafety", "PUBLIC_ARTIFACT_ROOT"],
        message:
          "generated-file checks must retain the paid Saas UI artifact boundary",
      },
      {
        file: "docs/template/saas-ui-upstream.json",
        includes: ['"licenses"', '"registry"'],
        message:
          "generated-file checks must consume the upstream Saas UI authority",
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
        file: "docs/template/convex-compatibility.json",
        includes: [
          '"schemaVersion": 1',
          '"@confect/server": "10.0.0-next.9"',
          '"effect": "4.0.0-beta.102"',
          '"convex-test": "0.0.54"',
        ],
        message: "machine compatibility authority must pin the tested set",
      },
      {
        file: "docs/template/confect-effect-guide.md",
        includes: [
          "@confect/server",
          "effect",
          "@effect/platform-node",
          "convex-test",
          "check:confect-compat",
        ],
        message:
          "Confect guide must record the resolved compatible package matrix",
      },
      {
        file: "packages/convex/package.json",
        includes: ['"confect:codegen"', '"check:convex"'],
        message:
          "Convex package must pin Confect-compatible runtime and codegen scripts",
      },
      {
        file: "apps/web/package.json",
        includes: [
          '"@confect/react": "10.0.0-next.9"',
          '"effect": "4.0.0-beta.102"',
          '"convex": "1.42.1"',
        ],
        message: "web package must pin the Confect React client set",
      },
      {
        file: "apps/cli/package.json",
        includes: [
          '"@confect/js": "10.0.0-next.9"',
          '"effect": "4.0.0-beta.102"',
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
          "system-catalog.json",
          "check:system-catalog",
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
      {
        file: "tooling/quality/check-sbom-license.mts",
        includes: ["assertSaasUiArtifactSafety", "check:sbom-license"],
        message:
          "SBOM/license verification must run the paid Saas UI artifact safety assertion",
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
        file: "packages/integrations/src/providerRegistry.ts",
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
          "Effect.catchCause",
          "Effect.catch(() => Effect.void)",
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
  "append-only-tables": {
    name: "check:append-only-tables",
    requirements: [
      {
        file: "tooling/quality/check-append-only-tables.mts",
        includes: [
          "typescript",
          "RAW_DB_MUTATION_ALLOWLIST",
          "DESTRUCTIVE_METHODS",
          "parseDataResourceCatalog",
          "packages/convex/confect",
          "packages/convex/convex",
        ],
        message:
          "append-only boundary must AST-block raw Convex destructive database access across canonical roots",
      },
      {
        file: "tooling/quality/check-append-only-tables.test.mts",
        includes: [
          "direct and optional destructive calls by opaque ID",
          "method declaration destructuring and destructuring assignment",
          "nested helpers and helpers returning raw databases",
          "dynamic computed access",
          "unrelated mutable objects",
          "literal table-bound writer mutations",
          "app deadline file an ID-evidence allowance",
          "component allowances patch-only",
        ],
        message:
          "raw database boundary must prove direct, alias, helper, optional, wrapper, and escape behavior",
      },
      {
        file: "package.json",
        includes: ["pnpm check:append-only-tables"],
        message: "root verification must enforce append-only tables",
      },
    ],
  },
  "app-map": {
    name: "check:app-map",
    requirements: [
      {
        file: "tooling/app-map/package.json",
        includes: [
          '"check": "pnpm lint && pnpm typecheck && pnpm test"',
          '"./composition"',
          '"./mcp"',
          '"./surface"',
        ],
        message: "App Map package must expose one closed deterministic check",
      },
      {
        file: "tooling/app-map/src/schema.ts",
        includes: [
          "APP_MAP_INPUT_MANIFEST_V1",
          "generator-provenance-facts",
          "template-instance-facts",
        ],
        message: "App Map must retain the frozen eleven-source input manifest",
      },
      {
        file: "tooling/app-map/src/composition.test.ts",
        includes: [
          "toHaveLength(11)",
          "must project facts",
          "serializeAppMap(first.build.map)",
          "serializeAppMap(second.build.map)",
        ],
        message:
          "App Map composition must prove complete sources and byte-stable double builds",
      },
      {
        file: "package.json",
        includes: ['"check:app-map": "pnpm --dir tooling/app-map check"'],
        message: "the focused App Map gate must remain available",
      },
    ],
  },
  "workflow-semantics": {
    name: "check:workflow-semantics",
    requirements: [
      {
        file: "packages/template-core/src/workflow-semantics/contract.ts",
        includes: [
          "WORKFLOW_GRAPH_FIELDS",
          "OFFICIAL_WORKFLOW_PRIMITIVES",
          "WF-HANDLER-DATE",
          "WF-HANDLER-RANDOM",
        ],
        message: "workflow semantics must have one executable support ledger",
      },
      {
        file: "tooling/quality/check-workflow-semantics.mts",
        includes: [
          "WF-GRAPH-UNMAPPED",
          "readWorkflowGraphFields",
          "WF-DOC-PROJECTION",
        ],
        message: "workflow semantic gate must inspect schemas and real runners",
      },
      {
        file: "docs/template/generated/workflow-semantics.md",
        includes: ["Generated Workflow Semantics", "WF-HANDLER-DATE"],
        message: "workflow semantics docs must be generated from the ledger",
      },
    ],
  },
  recipes: {
    name: "check:recipes",
    requirements: [
      {
        file: "tooling/quality/check-recipes.mts",
        includes: ["checkRecipes", "index.generated.json"],
        message: "recipe validation must inspect the live generated index",
      },
      {
        file: "docs/template/recipes/index.generated.json",
        includes: ["schemaVersion", "recipes"],
        message: "recipe discovery must use the generated canonical index",
      },
    ],
  },
  taste: {
    name: "taste:eval",
    requirements: [],
  },
  "contract-review": {
    name: "review:contract",
    requirements: [],
  },
  "product-contract": {
    name: "check:product-contract",
    requirements: [],
  },
  "acceptance-required": {
    name: "acceptance:required",
    requirements: [],
  },
} satisfies Record<string, StaticCheckDescriptor>;

type DiagnosticOverride = Pick<StaticCheckDiagnosticMetadata, "evidenceClass"> &
  Partial<
    Pick<
      StaticCheckDiagnosticMetadata,
      | "posture"
      | "canonicalDoc"
      | "repairHint"
      | "focusedPathPrefixes"
      | "defaultFocused"
      | "prerequisiteCheck"
      | "semanticRuleIds"
    >
  >;

type RegisteredCheckDescriptors<
  Definitions extends Record<string, StaticCheckDescriptor>,
> = {
  readonly [GateId in keyof Definitions]: Definitions[GateId] &
    RegisteredStaticCheckDescriptor & { readonly gateId: GateId };
};

function defineRegisteredStaticCheckDescriptors<
  const Definitions extends Record<string, StaticCheckDescriptor>,
>(
  definitions: Definitions,
  overrides: { readonly [GateId in keyof Definitions]: DiagnosticOverride },
): RegisteredCheckDescriptors<Definitions> {
  return Object.fromEntries(
    Object.entries(definitions).map(([gateId, descriptor]) => {
      const override = overrides[gateId];
      const [script] = descriptor.name.split(" ");
      if (script === undefined || script.length === 0) {
        throw new Error(
          `${gateId}: check descriptor must name an exact script`,
        );
      }
      const command = ["pnpm", script] as const;
      return [
        gateId,
        {
          ...descriptor,
          gateId,
          posture: "required" as const,
          canonicalDoc: "docs/rule-coverage.md",
          repairHint:
            "Repair the reported invariant in its owning source and rerun this check.",
          argv: command,
          rerun: command,
          focusedPathPrefixes: [
            ...new Set(descriptor.requirements.map(({ file }) => file)),
          ],
          ...override,
        },
      ];
    }),
  ) as unknown as RegisteredCheckDescriptors<Definitions>;
}

export const checkDescriptors = defineRegisteredStaticCheckDescriptors(
  checkDescriptorDefinitions,
  {
    "ci-completeness": { evidenceClass: "static" },
    "config-drift": { evidenceClass: "static" },
    "app-map": { evidenceClass: "static" },
    "append-only-tables": {
      evidenceClass: "static",
      defaultFocused: true,
      canonicalDoc: "docs/template/data-lifecycle.md",
      focusedPathPrefixes: [
        "docs/template/data-resources.json",
        "packages/convex/confect",
        "tooling/quality/check-append-only-tables.mts",
        "tooling/quality/check-append-only-tables.test.mts",
        "package.json",
      ],
    },
    deps: { evidenceClass: "static" },
    knip: { evidenceClass: "static" },
    "route-tree": { evidenceClass: "static" },
    "types-coverage": { evidenceClass: "static" },
    gates: { evidenceClass: "static", defaultFocused: true },
    debt: { evidenceClass: "static" },
    generators: { evidenceClass: "static" },
    "docs-freshness": { evidenceClass: "static" },
    "generated-files": { evidenceClass: "static" },
    "confect-contracts": { evidenceClass: "static" },
    "confect-compat": { evidenceClass: "static" },
    "schema-migration-notes": { evidenceClass: "static" },
    "layer-boundaries": { evidenceClass: "static" },
    "secret-canaries": {
      evidenceClass: "static",
      defaultFocused: true,
      prerequisiteCheck: ["gitleaks", "version"],
      repairHint:
        "Install the checksum-pinned scanner with bash tooling/ci/install-gitleaks.sh, then rerun this check.",
    },
    "sbom-license": { evidenceClass: "static" },
    "headless-surface-contract": {
      evidenceClass: "static",
      defaultFocused: true,
    },
    "posthog-readiness": { evidenceClass: "static" },
    "auth-demo-bypass": { evidenceClass: "static" },
    "workflow-graph-boundary": { evidenceClass: "static" },
    "workflow-semantics": {
      evidenceClass: "static",
      defaultFocused: true,
      canonicalDoc: "docs/template/generated/workflow-semantics.md",
      semanticRuleIds: [
        "WF-CONTRACT",
        "WF-DOC-PROJECTION",
        "WF-GRAPH-STALE",
        "WF-GRAPH-UNMAPPED",
      ],
    },
    recipes: {
      evidenceClass: "static",
      canonicalDoc:
        "docs/superpowers/plans/2026-07-24-maestro-agent-pack-productization-plan.md",
      focusedPathPrefixes: [
        "packages/template-core/src/recipes",
        "docs/template/recipes",
        "docs/template/recipes/index.generated.json",
        "tooling/agent-pack/src/recipes.ts",
        "tooling/quality/check-recipes.mts",
      ],
      semanticRuleIds: ["WP-4.3"],
    },
    taste: {
      posture: "advisory",
      evidenceClass: "advisory",
      canonicalDoc: "docs/template/reviewer-guide.md",
      repairHint:
        "Review the reported product-quality finding in the affected surface.",
      focusedPathPrefixes: ["apps/", "packages/", "tooling/"],
    },
    "contract-review": {
      posture: "advisory",
      evidenceClass: "advisory",
      canonicalDoc: "docs/template/reviewer-guide.md",
      repairHint:
        "Review the reported contract finding at its owning boundary.",
      focusedPathPrefixes: ["apps/", "packages/", "tooling/"],
    },
    "product-contract": { evidenceClass: "static" },
    "acceptance-required": { evidenceClass: "runtime" },
  },
);

export type CheckName = keyof typeof checkDescriptors;

export function descriptorFor(name: CheckName): StaticCheckDescriptor {
  return checkDescriptors[name];
}
