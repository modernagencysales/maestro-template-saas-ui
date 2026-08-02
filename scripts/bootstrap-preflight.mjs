#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const match = /^pnpm@([^+\s]+)(?:\+.*)?$/.exec(manifest.packageManager ?? "");

if (!match) {
  process.stderr.write(
    "Bootstrap blocked: package.json must declare an exact pnpm packageManager version.\n",
  );
  process.exitCode = 1;
} else {
  const required = match[1];
  const observed = spawnSync("pnpm", ["--version"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5_000,
  });
  const current =
    observed.status === 0 ? observed.stdout.trim() : "unavailable";
  const install = `npx --yes pnpm@${required} install --frozen-lockfile`;

  if (current === required) {
    process.stdout.write(
      `Bootstrap ready: pnpm ${required} is ready.\nNext: pnpm install --frozen-lockfile\n`,
    );
  } else {
    process.stderr.write(
      [
        `Bootstrap blocked: found pnpm ${current}; required pnpm ${required}.`,
        `Run: ${install}`,
        `Optional Corepack path: corepack prepare pnpm@${required} --activate`,
        "If Corepack reports a signing-key error, use the npx command above.",
      ].join("\n") + "\n",
    );
    process.exitCode = 1;
  }
}
