#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const safeExec = (file, args) => {
  try {
    return execFileSync(file, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

export function inspectBootstrap(facts) {
  const nodeMajor = Number(/^v?(\d+)/.exec(facts.nodeVersion)?.[1]);
  const nodeReady = nodeMajor === facts.requiredNodeMajor;
  const pnpmReady = facts.pnpmVersion === facts.requiredPnpmVersion;
  const identityReady = Boolean(facts.gitName && facts.gitEmail);
  const installCommand =
    facts.corepack === "ready"
      ? `corepack pnpm@${facts.requiredPnpmVersion} install --frozen-lockfile`
      : `npx --yes pnpm@${facts.requiredPnpmVersion} install --frozen-lockfile`;
  const diagnostics = [
    ...(nodeReady
      ? []
      : [
          {
            code: "BOOTSTRAP_NODE_UNSUPPORTED",
            message: `Template requires Node ${facts.requiredNodeMajor}; found ${facts.nodeVersion}.`,
          },
        ]),
    ...(pnpmReady || facts.pnpmVersion === null
      ? []
      : [
          {
            code: "BOOTSTRAP_PNPM_UNSUPPORTED",
            message: `Template requires pnpm ${facts.requiredPnpmVersion}; found ${facts.pnpmVersion}.`,
          },
        ]),
    ...(identityReady
      ? []
      : [
          {
            code: "BOOTSTRAP_GIT_IDENTITY_MISSING",
            message: "Git author name and email are not configured.",
          },
        ]),
  ];
  return {
    ok: nodeReady && identityReady,
    installCommand,
    diagnostics,
    repairs: [
      ...(!nodeReady
        ? [`Install Node ${facts.requiredNodeMajor} and rerun this command.`]
        : []),
      installCommand,
      ...(identityReady
        ? []
        : [
            'git config user.name "Your Name"',
            'git config user.email "you@example.com"',
          ]),
    ],
    facts,
  };
}

export function renderBootstrapHuman(report) {
  const lines = [
    report.ok
      ? "Bootstrap prerequisites are ready."
      : "Bootstrap needs attention.",
  ];
  if (report.facts.corepack === "missing")
    lines.push("Corepack is unavailable; use the pinned npx fallback.");
  lines.push(
    ...report.diagnostics.map(({ code, message }) => `${code}: ${message}`),
  );
  lines.push("Next:", ...report.repairs.map((repair) => `  ${repair}`));
  return `${lines.join("\n")}\n`;
}

function runtimeFacts() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const requiredPnpmVersion = String(packageJson.packageManager).replace(
    /^pnpm@/,
    "",
  );
  return {
    nodeVersion: process.version,
    requiredNodeMajor: Number(
      readFileSync(new URL("../.nvmrc", import.meta.url), "utf8")
        .trim()
        .replace(/^v/, "")
        .split(".")[0],
    ),
    pnpmVersion: safeExec("pnpm", ["--version"]),
    requiredPnpmVersion,
    corepack:
      safeExec("corepack", ["--version"]) === null ? "missing" : "ready",
    gitName: safeExec("git", ["config", "--get", "user.name"]),
    gitEmail: safeExec("git", ["config", "--get", "user.email"]),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = inspectBootstrap(runtimeFacts());
  process.stdout.write(
    process.argv.includes("--json")
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderBootstrapHuman(report),
  );
  process.exitCode = report.ok ? 0 : 1;
}
