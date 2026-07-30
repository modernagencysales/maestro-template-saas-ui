import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import {
  inspectBootstrap,
  renderBootstrapHuman,
} from "./maestro-bootstrap.mjs";

const ready = {
  nodeVersion: "v22.23.2",
  requiredNodeMajor: 22,
  pnpmVersion: "10.12.1",
  requiredPnpmVersion: "10.12.1",
  corepack: "ready",
  gitName: "Template User",
  gitEmail: "template@example.invalid",
};

test("recommends the pinned npx fallback when Corepack is unavailable", () => {
  const report = inspectBootstrap({ ...ready, corepack: "missing" });
  assert.equal(report.ok, true);
  assert.equal(
    report.installCommand,
    "npx --yes pnpm@10.12.1 install --frozen-lockfile",
  );
  assert.match(renderBootstrapHuman(report), /Corepack is unavailable/);
});

test("reports repository-local Git identity commands", () => {
  const report = inspectBootstrap({ ...ready, gitName: null, gitEmail: null });
  assert.equal(report.ok, false);
  assert.deepEqual(report.repairs.slice(-2), [
    'git config user.name "Your Name"',
    'git config user.email "you@example.com"',
  ]);
});

test("rejects an unsupported Node major before install", () => {
  const report = inspectBootstrap({ ...ready, nodeVersion: "v26.3.0" });
  assert.equal(report.ok, false);
  assert.match(report.diagnostics[0].message, /requires Node 22/);
});

test("stores pnpm 10 settings in pnpm-workspace.yaml without warning", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const workspace = readFileSync(
    new URL("../pnpm-workspace.yaml", import.meta.url),
    "utf8",
  );

  assert.equal(packageJson.pnpm, undefined);
  assert.match(workspace, /^overrides:/m);
  assert.match(workspace, /^patchedDependencies:/m);
  assert.match(workspace, /^onlyBuiltDependencies:/m);
});
