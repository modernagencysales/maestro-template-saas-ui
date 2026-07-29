import { describe, expect, it } from "vitest";
import {
  deploymentReceiptFromEnv,
  verifyRollbackReceipt,
} from "./check-deploy-authority-receipt.mts";

const baseEnv = {
  DEPLOY_ENVIRONMENT: "production",
  BUILDKITE_BUILD_ID: "build-123",
  BUILDKITE_COMMIT: "a".repeat(40),
  CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  PREVIOUS_CONVEX_COMMIT_SHA: "b".repeat(40),
  PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
  CLOUDFLARE_PAGES_PROJECT: "maestro-template",
  CLOUDFLARE_PAGES_BRANCH: "main",
  CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
  PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
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
    expect(() =>
      verifyRollbackReceipt(receipt, {
        DEPLOY_ENVIRONMENT: "production",
        BUILDKITE_COMMIT: "b".repeat(40),
        CONVEX_DEPLOYMENT: "prod:maestro-template-production",
        ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
        PREVIOUS_CONVEX_COMMIT_SHA: "a".repeat(40),
        PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
        PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
      }),
    ).not.toThrow();
    for (const env of [
      { BUILDKITE_COMMIT: "c".repeat(40) },
      { CONVEX_DEPLOYMENT: "prod:other" },
      { ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "c".repeat(40) },
      { DEPLOY_ENVIRONMENT: "staging" },
    ]) {
      expect(() =>
        verifyRollbackReceipt(receipt, {
          DEPLOY_ENVIRONMENT: "production",
          BUILDKITE_COMMIT: "b".repeat(40),
          CONVEX_DEPLOYMENT: "prod:maestro-template-production",
          ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
          PREVIOUS_CONVEX_COMMIT_SHA: "a".repeat(40),
          PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
          PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
          ...env,
        }),
      ).toThrow();
    }
    for (const env of [
      { PREVIOUS_CONVEX_COMMIT_SHA: "c".repeat(40) },
      { PREVIOUS_CONVEX_DEPLOYMENT: "prod:other" },
      { PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "c".repeat(40) },
    ]) {
      expect(() =>
        verifyRollbackReceipt(receipt, {
          DEPLOY_ENVIRONMENT: "production",
          BUILDKITE_COMMIT: "b".repeat(40),
          CONVEX_DEPLOYMENT: "prod:maestro-template-production",
          ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION: "b".repeat(40),
          PREVIOUS_CONVEX_COMMIT_SHA: "a".repeat(40),
          PREVIOUS_CONVEX_DEPLOYMENT: "prod:maestro-template-production",
          PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: "a".repeat(40),
          ...env,
        }),
      ).toThrow();
    }
  });
});
