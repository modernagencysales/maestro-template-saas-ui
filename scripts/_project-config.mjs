#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";

const repoRoot = process.cwd();
const config = JSON.parse(
  readFileSync(resolve(repoRoot, "project.config.json"), "utf8"),
);

const [command, environmentName, field] = process.argv.slice(2);

const environment = (name) => {
  const selected = config.environments?.[name];
  if (!selected) {
    throw new Error(`Unknown environment: ${name}`);
  }
  return selected;
};

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value || value !== process.env[name]) {
    throw new Error(`Missing or invalid required project binding: ${name}`);
  }
  return value;
};

const value = (name, fieldName) => {
  const selected = environment(name);
  const envName = selected[`${fieldName}Env`];
  if (typeof envName === "string") return requiredEnv(envName);
  const direct = selected[fieldName];
  if (typeof direct === "string") return direct;
  throw new Error(`Field is not configured: ${fieldName}`);
};

const convexIdentity = (rawUrl) => {
  const parsed = new URL(rawUrl);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Convex URL bindings must be credential-free HTTPS origins",
    );
  }
  for (const suffix of [".convex.cloud", ".convex.site"]) {
    if (!parsed.hostname.endsWith(suffix)) continue;
    const deployment = parsed.hostname.slice(0, -suffix.length);
    if (/^[a-z0-9-]+$/u.test(deployment)) return deployment;
  }
  throw new Error("Convex URL binding does not identify a Convex deployment");
};

const convexDeployIdentity = (rawName) => {
  const match = /^(?:dev|prod):([a-z0-9-]+)$/u.exec(rawName);
  if (!match?.[1]) {
    throw new Error(
      "Convex deployment bindings must be dev:<name> or prod:<name>",
    );
  }
  return match[1];
};

const assertConvexBinding = (name) => {
  const selected = environment(name);
  const expectedIdentity = selected.convexDeployName;
  const deployment = value(name, "convexDeployName");
  const deployIdentity = convexDeployIdentity(deployment);
  const urlIdentity = convexIdentity(value(name, "convexUrl"));
  if (
    typeof expectedIdentity !== "string" ||
    deployIdentity !== expectedIdentity ||
    urlIdentity !== expectedIdentity
  ) {
    throw new Error(
      `${name} Convex deployment and URL bindings must match ${expectedIdentity}`,
    );
  }
  return deployment;
};

const assertIsolatedConvex = () => {
  if (config.requireDistinctConvexDeployments !== true) {
    throw new Error("Project config must require distinct Convex deployments");
  }
  const stagingName = assertConvexBinding("staging");
  const productionName = assertConvexBinding("production");
  if (
    stagingName === productionName ||
    convexDeployIdentity(stagingName) === convexDeployIdentity(productionName)
  ) {
    throw new Error(
      "Staging and production Convex deployments must be distinct",
    );
  }
};

const assertConvexDeployKey = (name) => {
  assertIsolatedConvex();
  const deployment = assertConvexBinding(name);
  const deployKey = requiredEnv("CONVEX_DEPLOY_KEY");
  const publicPrefix = `${deployment}|`;
  if (
    !deployKey.startsWith(publicPrefix) ||
    deployKey.length === publicPrefix.length ||
    /\s/u.test(deployKey)
  ) {
    throw new Error(
      `CONVEX_DEPLOY_KEY does not target the selected ${name} deployment`,
    );
  }
};

if (command === "get") {
  if (!environmentName || !field) {
    throw new Error("Usage: _project-config.mjs get <environment> <field>");
  }
  process.stdout.write(`${value(environmentName, field)}\n`);
} else if (command === "assert-isolated-convex") {
  assertIsolatedConvex();
} else if (command === "assert-convex-deploy-key") {
  if (!environmentName) {
    throw new Error(
      "Usage: _project-config.mjs assert-convex-deploy-key <environment>",
    );
  }
  assertConvexDeployKey(environmentName);
} else if (command === "required-secrets") {
  if (!environmentName) {
    throw new Error(
      "Usage: _project-config.mjs required-secrets <environment>",
    );
  }
  process.stdout.write(
    `${environment(environmentName).requiredSecrets.join("\n")}\n`,
  );
} else {
  throw new Error(
    "Usage: _project-config.mjs get <environment> <field> | required-secrets <environment> | assert-isolated-convex | assert-convex-deploy-key <environment>",
  );
}
