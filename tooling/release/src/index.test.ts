import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDeployDoctorReport,
  buildProductionPromotePlan,
  buildStagingDeployPlan,
  buildCompletionAuditReport,
  buildClientReleaseReport,
  buildReviewerReadinessReport,
  runReleaseCli,
  smokeWebStaticBuild,
} from "./index";

const makeRepo = (): string => {
  const repoRoot = join(
    tmpdir(),
    `maestro-template-release-${Math.random().toString(16).slice(2)}`,
  );
  const dist = join(repoRoot, "apps/web/dist");
  const assets = join(dist, "assets");

  mkdirSync(assets, { recursive: true });
  writeFileSync(
    join(dist, "index.html"),
    '<div id="root"></div><script type="module" src="/assets/index.js"></script>',
  );
  writeFileSync(join(assets, "index.js"), "console.log('ok');");

  return repoRoot;
};

const makeStartRepo = (): string => {
  const repoRoot = join(
    tmpdir(),
    `maestro-template-start-release-${Math.random().toString(16).slice(2)}`,
  );
  const client = join(repoRoot, "apps/web/dist/client");
  const assets = join(client, "assets");

  mkdirSync(assets, { recursive: true });
  writeFileSync(
    join(client, "_shell.html"),
    '<title>Maestro Template</title><script type="module" src="/assets/index.js"></script>',
  );
  writeFileSync(join(assets, "index.js"), "console.log('ok');");

  return repoRoot;
};

const makeReviewerRepo = (): string => {
  const repoRoot = join(
    tmpdir(),
    `maestro-template-review-${Math.random().toString(16).slice(2)}`,
  );
  const files = [
    "README.md",
    "AGENTS.md",
    "docs/template/investor-reviewer-packet.md",
    "docs/template/reviewer-guide.md",
    "docs/template/repo-map.md",
    "docs/template/confect-effect-guide.md",
    "docs/template/app-factory-guide.md",
    "docs/template/quickstart.md",
    "docs/template/private-package-guide.md",
    "docs/template/hosting.md",
    "docs/template/security.md",
    "docs/template/coding-standards.md",
    "docs/template/capability-authoring-guide.md",
    "docs/template/integrations.md",
    "docs/template/workflow-authoring-guide.md",
    "docs/rule-coverage.md",
    ".buildkite/pipeline.yml",
    "apps/cli/src/index.ts",
    "apps/web/src/routes/index.tsx",
    "apps/web/src/saas-ui/business-shell.tsx",
    "apps/web/src/sample/templateData.ts",
    "apps/web/src/sample/templateData.test.ts",
    "examples/generic-ai-ops/seed/workspace.json",
    "examples/generic-ai-ops/seed/brain-pages.md",
    "examples/generic-ai-ops/seed/workflows.json",
    "packages/convex/confect/http.ts",
    "packages/convex/confect/_generated/refs.ts",
    "packages/convex/confect/jobs/workpool.spec.ts",
    "packages/convex/test/confect-contracts.test.ts",
    "packages/integrations/src/index.ts",
    "packages/integrations/src/index.test.ts",
    "packages/workflow-ui/src/index.tsx",
    "packages/template-core/src/index.ts",
    "tooling/quality/check-auth-demo-bypass.mts",
    "tooling/quality/check-secret-canaries.mts",
    "tooling/quality/check-workflow-graph-boundary.mts",
    "tooling/workflow/src/index.ts",
    "tooling/generators/src/index.ts",
    "tooling/generators/src/index.test.ts",
    "tooling/release/src/index.ts",
    "tooling/release/src/index.test.ts",
    "tests/e2e/hosted-reference-app.spec.ts",
    "tests/e2e/hosted-reference-app.visual.spec.ts",
  ];

  for (const file of files) {
    const fullPath = join(repoRoot, file);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, "ok");
  }

  return repoRoot;
};

const writeEnvManifest = (
  repoRoot: string,
  variables: readonly {
    readonly name: string;
    readonly group: string;
    readonly requiredFor: readonly string[];
  }[],
): void => {
  const path = join(repoRoot, "docs/template/env-manifest.json");

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        schemaVersion: 1,
        variables,
      },
      null,
      2,
    ),
  );
};

describe("release tooling", () => {
  it("passes for a built static web app", () => {
    const repoRoot = makeRepo();

    try {
      expect(smokeWebStaticBuild({ repoRoot })).toMatchObject({
        ok: true,
        assetCount: 1,
        checks: expect.arrayContaining([
          expect.objectContaining({ id: "web:index", status: "pass" }),
          expect.objectContaining({ id: "web:root", status: "pass" }),
          expect.objectContaining({
            id: "web:assets-linked",
            status: "pass",
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("passes for a TanStack Start static shell build", () => {
    const repoRoot = makeStartRepo();

    try {
      expect(smokeWebStaticBuild({ repoRoot })).toMatchObject({
        ok: true,
        assetCount: 1,
        checks: expect.arrayContaining([
          expect.objectContaining({
            id: "web:start-shell",
            status: "pass",
          }),
          expect.objectContaining({
            id: "web:assets-linked",
            status: "pass",
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("fails clearly before the static build exists", () => {
    const repoRoot = join(
      tmpdir(),
      `maestro-template-release-missing-${Math.random().toString(16).slice(2)}`,
    );

    expect(smokeWebStaticBuild({ repoRoot })).toMatchObject({
      ok: false,
      assetCount: 0,
      checks: expect.arrayContaining([
        expect.objectContaining({ id: "web:index", status: "fail" }),
        expect.objectContaining({ id: "web:assets", status: "fail" }),
      ]),
    });
  });

  it("exposes a CLI smoke report", () => {
    const repoRoot = makeRepo();

    try {
      const result = runReleaseCli(["smoke-web-static"], repoRoot);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        assetCount: 1,
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("builds an investor readiness report", () => {
    const repoRoot = makeReviewerRepo();

    try {
      const report = buildReviewerReadinessReport({
        repoRoot,
        commit: "abc1234",
        hostedUrl: "https://example.test",
      });

      expect(report).toMatchObject({
        ok: true,
        auditKind: "presence",
        warning:
          "Presence audit only: this report checks required files and listed evidence paths. Run pnpm verify for behavior.",
        commit: "abc1234",
        hostedUrl: "https://example.test",
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            path: "docs/template/investor-reviewer-packet.md",
            status: "pass",
          }),
          expect.objectContaining({
            path: "docs/rule-coverage.md",
            status: "pass",
          }),
          expect.objectContaining({
            path: "packages/convex/confect/_generated/refs.ts",
            status: "pass",
          }),
        ]),
        claims: expect.arrayContaining([
          expect.objectContaining({
            id: "confect-effect-contracts",
            status: "pass",
            evidence: expect.arrayContaining([
              "packages/convex/confect/_generated/refs.ts",
              "packages/convex/test/confect-contracts.test.ts",
            ]),
          }),
          expect.objectContaining({
            id: "app-factory-generators",
            status: "pass",
            evidence: expect.arrayContaining([
              "tooling/generators/src/index.ts",
              "docs/template/private-package-guide.md",
            ]),
          }),
        ]),
        commands: expect.arrayContaining([
          "pnpm check:format",
          "pnpm check:confect-contracts",
          "pnpm check:confect-compat",
          "pnpm smoke:hosted:browser",
          "pnpm smoke:hosted:visual",
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("exposes a CLI investor readiness report", () => {
    const repoRoot = makeReviewerRepo();

    try {
      const result = runReleaseCli(["review-readiness"], repoRoot);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        auditKind: "presence",
        warning:
          "Presence audit only: this report checks required files and listed evidence paths. Run pnpm verify for behavior.",
        hostedUrl: "https://maestro-template.pages.dev",
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("builds a completion audit report", () => {
    const repoRoot = makeReviewerRepo();

    try {
      const report = buildCompletionAuditReport({
        repoRoot,
        commit: "abc1234",
        hostedUrl: "https://example.test",
      });

      expect(report).toMatchObject({
        ok: true,
        auditKind: "presence",
        warning:
          "Presence audit only: this report checks evidence paths. It does not execute verification commands or inspect generated handoff content; run pnpm verify and client-release for behavior.",
        commit: "abc1234",
        hostedUrl: "https://example.test",
        requirements: expect.arrayContaining([
          expect.objectContaining({
            id: "private-template-repo",
            status: "pass",
          }),
          expect.objectContaining({
            id: "clear-sample-app",
            status: "pass",
            verification: expect.arrayContaining([
              "pnpm smoke:hosted:browser",
              "pnpm smoke:hosted:visual",
            ]),
          }),
          expect.objectContaining({
            id: "investor-handoff",
            status: "pass",
          }),
          expect.objectContaining({
            id: "day-0-factory-loop",
            status: "pass",
            evidence: expect.arrayContaining([
              "docs/template/quickstart.md",
              "tooling/generators/src/index.test.ts",
              "tooling/release/src/index.test.ts",
            ]),
            verification: expect.arrayContaining([
              'pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Reviewer Brain" --write',
              "pnpm template:doctor -- --mode fake",
              "pnpm template:handoff -- --mode fake --write",
            ]),
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("exposes a CLI completion audit report", () => {
    const repoRoot = makeReviewerRepo();

    try {
      const result = runReleaseCli(["review-completion"], repoRoot);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        auditKind: "presence",
        warning:
          "Presence audit only: this report checks evidence paths. It does not execute verification commands or inspect generated handoff content; run pnpm verify and client-release for behavior.",
        hostedUrl: "https://maestro-template.pages.dev",
        requirements: expect.arrayContaining([
          expect.objectContaining({ id: "app-factory", status: "pass" }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("builds deploy doctor reports without leaking secret values", () => {
    const repoRoot = makeReviewerRepo();
    writeEnvManifest(repoRoot, [
      {
        name: "CLOUDFLARE_API_TOKEN",
        group: "cloudflare",
        requiredFor: ["deploy"],
      },
      {
        name: "CONVEX_DEPLOY_KEY",
        group: "convex",
        requiredFor: ["deploy"],
      },
      {
        name: "WORKOS_API_KEY",
        group: "workos",
        requiredFor: ["live"],
      },
    ]);
    writeFileSync(
      join(repoRoot, "project.config.json"),
      JSON.stringify({
        project: { name: "maestro-template" },
        environments: {
          staging: {
            name: "staging",
            domain: "staging.example.test",
            cloudflarePagesProject: "maestro-template-staging",
            cloudflareBranch: "staging",
            convexDeployName: "maestro-template-staging",
            requiredEnvGroups: ["cloudflare", "convex"],
            requiredSecrets: ["CLOUDFLARE_API_TOKEN", "CONVEX_DEPLOY_KEY"],
          },
          production: {
            name: "production",
            domain: "app.example.test",
            cloudflarePagesProject: "maestro-template",
            cloudflareBranch: "main",
            convexDeployName: "maestro-template-production",
            requiredEnvGroups: ["cloudflare", "convex"],
            requiredSecrets: ["CLOUDFLARE_API_TOKEN", "CONVEX_DEPLOY_KEY"],
          },
        },
      }),
    );

    try {
      const report = buildDeployDoctorReport({
        repoRoot,
        environment: "staging",
        env: { CLOUDFLARE_API_TOKEN: "super-secret-value" },
      });

      expect(report).toMatchObject({
        ok: false,
        environment: "staging",
        cloudflarePagesProject: "maestro-template-staging",
        requiredEnvNames: ["CLOUDFLARE_API_TOKEN", "CONVEX_DEPLOY_KEY"],
        missingEnvNames: ["CONVEX_DEPLOY_KEY"],
        missingSecretNames: ["CONVEX_DEPLOY_KEY"],
        alert: {
          severity: "warning",
          title: "Deploy doctor failed: staging",
          dedupeKey: "deploy-doctor:staging:CONVEX_DEPLOY_KEY",
          metadata: {
            environment: "staging",
            missingEnvNames: ["CONVEX_DEPLOY_KEY"],
            missingSecretNames: ["CONVEX_DEPLOY_KEY"],
          },
        },
      });
      expect(JSON.stringify(report)).not.toContain("super-secret-value");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("uses manifest groups to require live provider env for production deploys", () => {
    const repoRoot = makeReviewerRepo();
    writeEnvManifest(repoRoot, [
      {
        name: "OPENROUTER_API_KEY",
        group: "openrouter",
        requiredFor: ["live"],
      },
      {
        name: "POSTHOG_PROJECT_TOKEN",
        group: "posthog",
        requiredFor: ["live"],
      },
      {
        name: "CLOUDFLARE_API_TOKEN",
        group: "cloudflare",
        requiredFor: ["deploy"],
      },
      {
        name: "LOCAL_ONLY_FAKE_KEY",
        group: "openrouter",
        requiredFor: ["fake"],
      },
    ]);
    writeFileSync(
      join(repoRoot, "project.config.json"),
      JSON.stringify({
        project: { name: "maestro-template" },
        environments: {
          staging: {
            name: "staging",
            domain: "staging.example.test",
            cloudflarePagesProject: "maestro-template-staging",
            cloudflareBranch: "staging",
            convexDeployName: "maestro-template-staging",
            requiredEnvGroups: ["cloudflare"],
            requiredSecrets: [],
          },
          production: {
            name: "production",
            domain: "app.example.test",
            cloudflarePagesProject: "maestro-template",
            cloudflareBranch: "main",
            convexDeployName: "maestro-template-production",
            requiredEnvGroups: ["cloudflare", "llm", "posthog"],
            requiredSecrets: [],
          },
        },
      }),
    );

    try {
      expect(
        buildDeployDoctorReport({
          repoRoot,
          environment: "production",
          env: {
            CLOUDFLARE_API_TOKEN: "cloudflare-secret",
            POSTHOG_PROJECT_TOKEN: "posthog-secret",
          },
        }),
      ).toMatchObject({
        ok: false,
        requiredEnvNames: [
          "CLOUDFLARE_API_TOKEN",
          "OPENROUTER_API_KEY",
          "POSTHOG_PROJECT_TOKEN",
        ],
        missingEnvNames: ["OPENROUTER_API_KEY"],
        alert: {
          severity: "critical",
          title: "Deploy doctor failed: production",
          dedupeKey: "deploy-doctor:production:OPENROUTER_API_KEY",
          metadata: {
            missingEnvNames: ["OPENROUTER_API_KEY"],
          },
        },
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("builds staging and production promotion plans from project config", () => {
    const repoRoot = makeReviewerRepo();
    writeFileSync(
      join(repoRoot, "project.config.json"),
      JSON.stringify({
        project: { name: "maestro-template" },
        environments: {
          staging: {
            name: "staging",
            domain: "staging.example.test",
            cloudflarePagesProject: "maestro-template-staging",
            cloudflareBranch: "staging",
            convexDeployName: "maestro-template-staging",
            requiredEnvGroups: ["cloudflare", "convex"],
            requiredSecrets: [],
          },
          production: {
            name: "production",
            domain: "app.example.test",
            cloudflarePagesProject: "maestro-template",
            cloudflareBranch: "main",
            convexDeployName: "maestro-template-production",
            requiredEnvGroups: ["cloudflare", "convex"],
            requiredSecrets: [],
          },
        },
      }),
    );

    try {
      expect(
        buildStagingDeployPlan({
          repoRoot,
          commitSha: "abc123",
        }),
      ).toMatchObject({
        environment: "staging",
        commitSha: "abc123",
        cloudflarePagesProject: "maestro-template-staging",
        cloudflareBranch: "staging",
        convexDeployName: "maestro-template-staging",
      });
      expect(
        buildProductionPromotePlan({
          repoRoot,
          stagedSha: "abc123",
          currentSha: "abc123",
        }),
      ).toMatchObject({
        ok: true,
        environment: "production",
        commitSha: "abc123",
        cloudflarePagesProject: "maestro-template",
        cloudflareBranch: "main",
      });
      expect(
        buildProductionPromotePlan({
          repoRoot,
          stagedSha: "abc123",
          currentSha: "def456",
        }),
      ).toMatchObject({
        ok: false,
        refusal:
          "Refusing production promotion: staged SHA abc123 does not match current SHA def456.",
        alert: {
          severity: "critical",
          title: "Production promotion refused",
          dedupeKey: "production-promote:def456:production",
          metadata: {
            environment: "production",
            commitSha: "def456",
            refusal:
              "Refusing production promotion: staged SHA abc123 does not match current SHA def456.",
          },
        },
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("builds a client release report with compatibility checks and handoff artifacts", () => {
    const repoRoot = makeReviewerRepo();
    const files = [
      "template-instance.json",
      "docs/template/generated/client-intake.md",
      "docs/template/generated/implementation-brief.md",
      "docs/template/generated/provider-setup-checklist.md",
      "docs/template/generated/handoff-packet.md",
      "docs/template/env-manifest.md",
      "docs/template/template-release-process.md",
    ];

    for (const file of files) {
      const fullPath = join(repoRoot, file);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(
        fullPath,
        file === "docs/template/generated/handoff-packet.md"
          ? "`real`\n`fake`\n`seam`\n`planned`\n"
          : "ok",
      );
    }

    try {
      const report = buildClientReleaseReport({
        repoRoot,
        templateVersion: "template-v1.2.0",
        clientVersion: "client-v0.1.0",
      });

      expect(report).toMatchObject({
        ok: true,
        templateVersion: "template-v1.2.0",
        clientVersion: "client-v0.1.0",
        compatibility: {
          status: "ready-for-review",
          requiredChecks: expect.arrayContaining([
            "pnpm check:generators",
            "pnpm check:confect-contracts",
            "pnpm check:workflow-graph-boundary",
          ]),
        },
        handoffArtifacts: expect.arrayContaining([
          expect.objectContaining({
            path: "docs/template/generated/client-intake.md",
            status: "pass",
          }),
          expect.objectContaining({
            path: "template-instance.json",
            status: "pass",
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("fails client release when the handoff packet omits status labels", () => {
    const repoRoot = makeReviewerRepo();
    const files = [
      "template-instance.json",
      "docs/template/generated/client-intake.md",
      "docs/template/generated/implementation-brief.md",
      "docs/template/generated/provider-setup-checklist.md",
      "docs/template/generated/handoff-packet.md",
      "docs/template/env-manifest.md",
      "docs/template/template-release-process.md",
    ];

    for (const file of files) {
      const fullPath = join(repoRoot, file);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, "ok");
    }

    try {
      const report = buildClientReleaseReport({
        repoRoot,
        templateVersion: "template-v1.2.0",
        clientVersion: "client-v0.1.0",
      });

      expect(report).toMatchObject({
        ok: false,
        compatibility: {
          status: "missing-artifacts",
        },
        handoffArtifacts: expect.arrayContaining([
          expect.objectContaining({
            path: "docs/template/generated/handoff-packet.md",
            status: "fail",
            detail: "missing handoff status labels: real, fake, seam, planned",
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("exposes a client release report through the release CLI", () => {
    const repoRoot = makeReviewerRepo();
    writeFileSync(join(repoRoot, "template-instance.json"), "ok");

    try {
      const result = runReleaseCli(
        ["client-release", "template-v1.2.0", "client-v0.1.0"],
        repoRoot,
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        templateVersion: "template-v1.2.0",
        clientVersion: "client-v0.1.0",
        handoffArtifacts: expect.arrayContaining([
          expect.objectContaining({
            path: "docs/template/generated/client-intake.md",
            status: "fail",
          }),
        ]),
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("exposes deploy doctor and plan reports through the release CLI", () => {
    const repoRoot = makeReviewerRepo();
    writeFileSync(
      join(repoRoot, "project.config.json"),
      JSON.stringify({
        project: { name: "maestro-template" },
        environments: {
          staging: {
            name: "staging",
            domain: "staging.example.test",
            cloudflarePagesProject: "maestro-template-staging",
            cloudflareBranch: "staging",
            convexDeployName: "maestro-template-staging",
            requiredEnvGroups: ["cloudflare"],
            requiredSecrets: [],
          },
          production: {
            name: "production",
            domain: "app.example.test",
            cloudflarePagesProject: "maestro-template",
            cloudflareBranch: "main",
            convexDeployName: "maestro-template-production",
            requiredEnvGroups: ["cloudflare"],
            requiredSecrets: [],
          },
        },
      }),
    );

    try {
      expect(
        JSON.parse(
          runReleaseCli(["deploy-doctor", "staging"], repoRoot).stdout,
        ),
      ).toMatchObject({
        ok: true,
        environment: "staging",
        requiredSecretNames: [],
      });
      expect(
        JSON.parse(runReleaseCli(["deploy-doctor"], repoRoot).stdout),
      ).toMatchObject({
        ok: true,
        environment: "production",
        requiredSecretNames: [],
      });
      expect(
        JSON.parse(
          runReleaseCli(["deploy-plan", "staging", "abc123"], repoRoot).stdout,
        ),
      ).toMatchObject({
        ok: true,
        cloudflarePagesProject: "maestro-template-staging",
      });
      expect(
        JSON.parse(
          runReleaseCli(["promote-plan", "abc123", "def456"], repoRoot).stdout,
        ),
      ).toMatchObject({
        ok: false,
        refusal:
          "Refusing production promotion: staged SHA abc123 does not match current SHA def456.",
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
