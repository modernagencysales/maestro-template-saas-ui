import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Env = Readonly<Record<string, string | undefined>>;

export type GuardedDeploymentReceipt = {
  readonly schemaVersion: 1;
  readonly kind: "guarded-deployment-receipt";
  readonly environment: "staging" | "production";
  readonly buildId: string;
  readonly commitSha: string;
  readonly convexDeployment: string;
  readonly previousConvexCommitSha: string;
  readonly previousConvexDeployment: string;
  readonly cloudflareProject: string;
  readonly cloudflareBranch: string;
  readonly cloudflareDeploymentVersion: string;
  readonly previousCloudflareDeploymentVersion: string;
  readonly hostedUrl: string;
};

const required = (env: Env, name: string): string => {
  const value = env[name]?.trim();
  if (!value || value !== env[name])
    throw new Error(
      `Missing or invalid required deployment coordinate: ${name}`,
    );
  return value;
};

const commit = (env: Env, name: string): string => {
  const value = required(env, name);
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value))
    throw new Error(`Invalid commit coordinate: ${name}`);
  return value;
};

const secretShaped = (value: string): boolean =>
  /(?:api[_-]?key|deploy[_-]?key|private[_-]?key|token|secret|password|credential|authorization|bearer)/iu.test(
    value,
  ) || /[|=]/u.test(value);

const coordinate = (env: Env, name: string): string => {
  const value = required(env, name);
  if (value.length > 256 || /\s/u.test(value) || secretShaped(value))
    throw new Error(`Invalid provider coordinate: ${name}`);
  return value;
};

const environment = (env: Env): "staging" | "production" => {
  const value = required(env, "DEPLOY_ENVIRONMENT");
  if (value !== "staging" && value !== "production")
    throw new Error("DEPLOY_ENVIRONMENT must be staging or production");
  return value;
};

const hostedUrl = (env: Env): string => {
  const value = required(env, "TEMPLATE_HOSTED_URL");
  if (secretShaped(value))
    throw new Error("TEMPLATE_HOSTED_URL must not contain secret-shaped data");
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("TEMPLATE_HOSTED_URL must be a credential-free HTTPS URL");
  return parsed.toString();
};

export const deploymentReceiptFromEnv = (
  env: Env,
): GuardedDeploymentReceipt => {
  const result: GuardedDeploymentReceipt = {
    schemaVersion: 1,
    kind: "guarded-deployment-receipt",
    environment: environment(env),
    buildId: coordinate(env, "CI_PIPELINE_NUMBER"),
    commitSha: commit(env, "CI_COMMIT_SHA"),
    convexDeployment: coordinate(env, "CONVEX_DEPLOYMENT"),
    previousConvexCommitSha: commit(env, "PREVIOUS_CONVEX_COMMIT_SHA"),
    previousConvexDeployment: coordinate(env, "PREVIOUS_CONVEX_DEPLOYMENT"),
    cloudflareProject: coordinate(env, "CLOUDFLARE_PAGES_PROJECT"),
    cloudflareBranch: coordinate(env, "CLOUDFLARE_PAGES_BRANCH"),
    cloudflareDeploymentVersion: commit(env, "CLOUDFLARE_DEPLOYMENT_VERSION"),
    previousCloudflareDeploymentVersion: commit(
      env,
      "PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION",
    ),
    hostedUrl: hostedUrl(env),
  };
  if (
    result.commitSha !== result.cloudflareDeploymentVersion ||
    result.previousConvexCommitSha !==
      result.previousCloudflareDeploymentVersion
  )
    throw new Error(
      "Convex and Cloudflare versions must identify the same release commits",
    );
  return result;
};

const receipt = (input: unknown): GuardedDeploymentReceipt => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Rollback receipt must be an object");
  const value = input as Record<string, unknown>;
  const expectedKeys = [
    "schemaVersion",
    "kind",
    "environment",
    "buildId",
    "commitSha",
    "convexDeployment",
    "previousConvexCommitSha",
    "previousConvexDeployment",
    "cloudflareProject",
    "cloudflareBranch",
    "cloudflareDeploymentVersion",
    "previousCloudflareDeploymentVersion",
    "hostedUrl",
  ];
  if (
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key)) ||
    value.schemaVersion !== 1 ||
    value.kind !== "guarded-deployment-receipt" ||
    expectedKeys
      .filter((key) => key !== "schemaVersion")
      .some((key) => typeof value[key] !== "string")
  )
    throw new Error("Rollback receipt has an invalid shape");
  const parsed = deploymentReceiptFromEnv({
    DEPLOY_ENVIRONMENT: String(value.environment),
    CI_PIPELINE_NUMBER: String(value.buildId),
    CI_COMMIT_SHA: String(value.commitSha),
    CONVEX_DEPLOYMENT: String(value.convexDeployment),
    PREVIOUS_CONVEX_COMMIT_SHA: String(value.previousConvexCommitSha),
    PREVIOUS_CONVEX_DEPLOYMENT: String(value.previousConvexDeployment),
    CLOUDFLARE_PAGES_PROJECT: String(value.cloudflareProject),
    CLOUDFLARE_PAGES_BRANCH: String(value.cloudflareBranch),
    CLOUDFLARE_DEPLOYMENT_VERSION: String(value.cloudflareDeploymentVersion),
    PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION: String(
      value.previousCloudflareDeploymentVersion,
    ),
    TEMPLATE_HOSTED_URL: String(value.hostedUrl),
  });
  return parsed;
};

export const verifyRollbackReceipt = (input: unknown, env: Env): void => {
  const parsed = receipt(input);
  const expectedEnvironment = environment(env);
  const expectedBuildId = coordinate(env, "ROLLBACK_RECEIPT_BUILD_ID");
  const checkedOutCommit = commit(env, "CI_COMMIT_SHA");
  const targetDeployment = coordinate(env, "CONVEX_DEPLOYMENT");
  const targetCloudflareVersion = commit(
    env,
    "ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION",
  );
  const releaseBeingReplaced = commit(env, "PREVIOUS_CONVEX_COMMIT_SHA");
  const releaseDeploymentBeingReplaced = coordinate(
    env,
    "PREVIOUS_CONVEX_DEPLOYMENT",
  );
  const cloudflareVersionBeingReplaced = commit(
    env,
    "PREVIOUS_CLOUDFLARE_DEPLOYMENT_VERSION",
  );
  const expectedCloudflareProject = coordinate(env, "CLOUDFLARE_PAGES_PROJECT");
  const expectedCloudflareBranch = coordinate(env, "CLOUDFLARE_PAGES_BRANCH");
  const expectedHostedUrl = hostedUrl(env);
  if (
    parsed.environment !== expectedEnvironment ||
    parsed.buildId !== expectedBuildId ||
    parsed.previousConvexCommitSha !== checkedOutCommit ||
    parsed.previousConvexDeployment !== targetDeployment ||
    parsed.previousCloudflareDeploymentVersion !== targetCloudflareVersion ||
    checkedOutCommit !== targetCloudflareVersion ||
    parsed.commitSha !== releaseBeingReplaced ||
    parsed.convexDeployment !== releaseDeploymentBeingReplaced ||
    parsed.cloudflareProject !== expectedCloudflareProject ||
    parsed.cloudflareBranch !== expectedCloudflareBranch ||
    parsed.cloudflareDeploymentVersion !== cloudflareVersionBeingReplaced ||
    parsed.hostedUrl !== expectedHostedUrl
  )
    throw new Error("Rollback coordinates do not match the reviewed receipt");
};

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, path] = process.argv.slice(2);
  if (!path) throw new Error("A deployment receipt path is required");
  if (command === "validate-inputs") {
    deploymentReceiptFromEnv(process.env);
  } else if (command === "record") {
    writeFileSync(
      path,
      `${JSON.stringify(deploymentReceiptFromEnv(process.env))}\n`,
      {
        encoding: "utf8",
        flag: "wx",
      },
    );
  } else if (command === "verify-rollback") {
    verifyRollbackReceipt(JSON.parse(readFileSync(path, "utf8")), process.env);
  } else {
    throw new Error(
      "Usage: check-deploy-authority-receipt <validate-inputs|record|verify-rollback> <path>",
    );
  }
}
