import { describe, expect, it } from "vitest";
import {
  deploymentReceiptFromEnv,
  verifyRollbackReceipt,
} from "./check-deploy-authority-receipt.mts";

const baseEnv = {
  DEPLOY_ENVIRONMENT: "production",
  CI_PIPELINE_NUMBER: "build-123",
  CI_COMMIT_SHA: "a".repeat(40),
  CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  PREVIOUS_CONVEX_COMMIT_SHA: "b".repeat(40),
  PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  CLOUDFLARE_PAGES_PROJECT: "maestro-template",
  CLOUDFLARE_PAGES_BRANCH: "main",
  CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
  PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
  TEMPLATE_HOSTED_URL: "https://app.example.test",
} as const;

const rollbackEnv = {
  DEPLOY_ENVIRONMENT: "production",
  CI_COMMIT_SHA: "b".repeat(40),
  CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
  PREVIOUS_CONVEX_COMMIT_SHA: "a".repeat(40),
  PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
  ROLLBACK_RECEIPT_BUILD_ID: "build-123",
  CLOUDFLARE_PAGES_PROJECT: "maestro-template",
  CLOUDFLARE_PAGES_BRANCH: "main",
  TEMPLATE_HOSTED_URL: "https://app.example.test",
} as const;

describe("deployment rollback receipt", () => {
  it("records exact current and prior provider coordinates without secrets", () => {
    expect(deploymentReceiptFromEnv(baseEnv)).toEqual({
      schemaVersion: 1,
      kind: "guarded-deployment-receipt",
      environment: "production",
      buildId: "build-123",
      commitSha: "a".repeat(40),
      convexDeployment: "prod:maestro-template-production",
      previousConvexCommitSha: "b".repeat(40),
      previousConvexDeployment: "prod:maestro-template-production",
      cloudflareProject: "maestro-template",
      cloudflareBranch: "main",
      cloudflareDeploymentVersion: "a".repeat(40),
      previousCloudflareDeploymentVersion: "b".repeat(40),
      hostedUrl: "https://app.example.test/",
    });
    expect(JSON.stringify(deploymentReceiptFromEnv(baseEnv))).not.toContain(
      "TOKEN",
    );
  });

  it("fails closed when any rollback coordinate is absent", () => {
    for (const key of Object.keys(baseEnv)) {
      expect(() =>
        deploymentReceiptFromEnv({ ...baseEnv, [key]: undefined }),
      ).toThrow();
    }
    expect(() =>
      deploymentReceiptFromEnv({
        ...baseEnv,
        PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "c".repeat(40),
      }),
    ).toThrow();
  });

  it("binds rollback to the prior receipt coordinates and checked-out commit", () => {
    const receipt = deploymentReceiptFromEnv(baseEnv);
    expect(() => verifyRollbackReceipt(receipt, rollbackEnv)).not.toThrow();
    for (const env of [
      { CI_COMMIT_SHA: "c".repeat(40) },
      { CONVEX_DEPLOYMENT: "prod:other" },
      { ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "c".repeat(40) },
      { DEPLOY_ENVIRONMENT: "staging" },
      { ROLLBACK_RECEIPT_BUILD_ID: "build-456" },
      { CLOUDFLARE_PAGES_PROJECT: "other-project" },
      { CLOUDFLARE_PAGES_BRANCH: "other-branch" },
      { TEMPLATE_HOSTED_URL: "https://other.example.test" },
    ]) {
      expect(() =>
        verifyRollbackReceipt(receipt, { ...rollbackEnv, ...env }),
      ).toThrow();
    }
    for (const env of [
      { PREVIOUS_CONVEX_COMMIT_SHA: "c".repeat(40) },
      { PREVIOUS_CONVEX_DEPLOYMENT: "prod:other" },
      { PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "c".repeat(40) },
    ]) {
      expect(() =>
        verifyRollbackReceipt(receipt, { ...rollbackEnv, ...env }),
      ).toThrow();
    }
  });

  it("rejects alteration of every public rollback receipt coordinate", () => {
    const receipt = deploymentReceiptFromEnv(baseEnv);
    const alterations = {
      environment: "staging",
      buildId: "build-456",
      commitSha: "c".repeat(40),
      convexDeployment: "prod:other-production",
      previousConvexCommitSha: "c".repeat(40),
      previousConvexDeployment: "prod:other-production",
      cloudflareProject: "other-project",
      cloudflareBranch: "other-branch",
      cloudflareDeploymentVersion: "c".repeat(40),
      previousCloudflareDeploymentVersion: "c".repeat(40),
      hostedUrl: "https://other.example.test/",
    } as const;
    for (const [key, value] of Object.entries(alterations)) {
      expect(
        () => verifyRollbackReceipt({ ...receipt, [key]: value }, rollbackEnv),
        key,
      ).toThrow();
    }
  });

  it("rejects secret and deploy-key-shaped public coordinates", () => {
    for (const [key, value] of [
      ["CI_PIPELINE_NUMBER", "api_token=not-public"],
      ["CONVEX_DEPLOYMENT", "prod:maestro-template-production|secret"],
      ["PREVIOUS_CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY"],
      ["CLOUDFLARE_PAGES_PROJECT", "private-key"],
      ["CLOUDFLARE_PAGES_BRANCH", "Bearer_not-public"],
      ["TEMPLATE_HOSTED_URL", "https://token.example.test"],
    ] as const) {
      expect(
        () => deploymentReceiptFromEnv({ ...baseEnv, [key]: value }),
        key,
      ).toThrow();
    }
    expect(JSON.stringify(deploymentReceiptFromEnv(baseEnv))).not.toMatch(
      /deploy[_-]?key|secret|token|password|bearer/iu,
    );
  });
});
