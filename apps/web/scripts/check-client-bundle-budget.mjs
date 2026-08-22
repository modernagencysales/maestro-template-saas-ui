#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const CLIENT_CHUNK_BUDGET_BYTES = 500 * 1024;

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path);
    }
  }

  return files;
}

export async function inspectClientBundleDirectory(
  directory,
  budgetBytes = CLIENT_CHUNK_BUDGET_BYTES,
) {
  const root = resolve(directory);
  const files = await collectJavaScriptFiles(root);
  const findings = [];

  for (const path of files) {
    const { size } = await stat(path);
    if (size > budgetBytes) {
      findings.push({
        bytes: size,
        path: relative(root, path).split(sep).join("/"),
      });
    }
  }

  return findings.sort((left, right) => left.path.localeCompare(right.path));
}

async function main() {
  const directory = resolve(process.cwd(), process.argv[2] ?? "dist/client");
  const findings = await inspectClientBundleDirectory(directory);

  if (findings.length === 0) {
    process.stdout.write(
      `Client bundle budget passed (${CLIENT_CHUNK_BUDGET_BYTES} bytes per JavaScript chunk).\n`,
    );
    return;
  }

  process.stderr.write(
    [
      `Client bundle budget exceeded (${CLIENT_CHUNK_BUDGET_BYTES} bytes per JavaScript chunk):`,
      ...findings.map(({ bytes, path }) => `- ${path}: ${bytes} bytes`),
      "Split the owning route or dependency group before raising the budget.",
      "",
    ].join("\n"),
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
