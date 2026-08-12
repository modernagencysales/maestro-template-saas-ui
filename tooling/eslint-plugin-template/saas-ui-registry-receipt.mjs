import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const RECEIPT_RELATIVE_PATH = "docs/template/saas-ui-registry-files.json";
const STARTER_RECEIPT_RELATIVE_PATH =
  "docs/template/saas-ui-starter-files.json";
const receiptCache = new Map();

function normalize(path) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function sourceRootForReceipt(receiptPath, destination) {
  let directory = dirname(receiptPath);
  while (true) {
    if (existsSync(resolve(directory, destination))) return directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return resolve(dirname(receiptPath), "../..");
}

function defaultReceiptPath() {
  let directory = resolve(process.cwd());
  while (true) {
    const candidate = join(directory, RECEIPT_RELATIVE_PATH);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return candidate;
    directory = parent;
  }
}

function defaultStarterReceiptPath() {
  let directory = resolve(process.cwd());
  while (true) {
    const candidate = join(directory, STARTER_RECEIPT_RELATIVE_PATH);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return candidate;
    directory = parent;
  }
}

function receiptEntries(receiptPath) {
  const path = resolve(receiptPath ?? defaultReceiptPath());
  const cached = receiptCache.get(path);
  if (cached) return cached;
  if (!existsSync(path)) return new Set();
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return new Set();
  }
  const entries = new Set();
  if (Array.isArray(value?.files)) {
    for (const file of value.files) {
      if (
        typeof file?.destination !== "string" ||
        !/^[a-f0-9]{64}$/u.test(String(file.sha256))
      )
        continue;
      const destination = normalize(file.destination);
      const root = sourceRootForReceipt(path, destination);
      const absolute = resolve(root, destination);
      if (!existsSync(absolute)) continue;
      const actual = createHash("sha256")
        .update(readFileSync(absolute))
        .digest("hex");
      if (actual === file.sha256) entries.add(destination);
    }
  }
  receiptCache.set(path, entries);
  return entries;
}

export function saasUiRegistryReceiptFiles(receiptPath) {
  return [...receiptEntries(receiptPath)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

export function saasUiStarterReceiptFiles(receiptPath) {
  return [...receiptEntries(receiptPath ?? defaultStarterReceiptPath())].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
}

export function isSaasUiRegistryReceiptFile(filename, receiptPath) {
  const normalizedFilename = normalize(filename);
  if (!normalizedFilename.startsWith("/")) {
    return receiptEntries(receiptPath).has(normalizedFilename);
  }
  const root = resolve(dirname(receiptPath ?? defaultReceiptPath()), "../..");
  return receiptEntries(receiptPath).has(
    normalize(relative(root, normalizedFilename)),
  );
}

export function isSaasUiStarterReceiptFile(filename, receiptPath) {
  const normalizedFilename = normalize(filename);
  const path = receiptPath ?? defaultStarterReceiptPath();
  if (basename(path) !== "saas-ui-starter-files.json") return false;
  if (!normalizedFilename.startsWith("/")) {
    return receiptEntries(path).has(normalizedFilename);
  }
  const root = resolve(dirname(path), "../..");
  return receiptEntries(path).has(
    normalize(relative(root, normalizedFilename)),
  );
}

export function receiptOption(context) {
  const option = context.options?.[0];
  return option && typeof option.receiptPath === "string"
    ? option.receiptPath
    : undefined;
}
