import { spawnSync } from "node:child_process";
import { posix } from "node:path";
import process from "node:process";
import { ESLint } from "eslint";

const RULES = ["complexity", "max-depth", "max-params"] as const;
const PATTERNS: Readonly<Record<Rule, RegExp>> = {
  complexity: /\bcomplexity of (\d+)\b/u,
  "max-depth": /\((\d+)\)\. Maximum allowed/u,
  "max-params": /\((\d+)\)\. Maximum allowed/u,
};

type Rule = (typeof RULES)[number];
type Debt = Record<Rule, number[]>;
type Message = Pick<
  ESLint.LintResult["messages"][number],
  "message" | "ruleId"
>;

function emptyDebt(): Debt {
  return { complexity: [], "max-depth": [], "max-params": [] };
}

function isRule(ruleId: string | null): ruleId is Rule {
  return RULES.some((rule) => rule === ruleId);
}

export function parseDebt(messages: readonly Message[]): Debt {
  const debt = emptyDebt();
  for (const message of messages) {
    if (!isRule(message.ruleId)) continue;
    const value = PATTERNS[message.ruleId].exec(message.message)?.[1];
    if (value === undefined) {
      throw new Error(`could not parse ${message.ruleId}: ${message.message}`);
    }
    debt[message.ruleId].push(Number(value));
  }
  for (const values of Object.values(debt)) values.sort((a, b) => b - a);
  return debt;
}

export function compareDebt(
  currentValues: readonly number[],
  baseValues: readonly number[],
): string[] {
  // Debt identity is intentionally each file/rule's descending value vector,
  // not the individual functions that happen to occupy those ranks.
  const current = [...currentValues].sort((a, b) => b - a);
  const base = [...baseValues].sort((a, b) => b - a);
  const failures: string[] = [];
  if (current.length > base.length) {
    const noun = current.length === 1 ? "violation" : "violations";
    const verb = current.length === 1 ? "exceeds" : "exceed";
    failures.push(
      `${String(current.length)} ${noun} ${verb} baseline count ${String(base.length)}`,
    );
  }
  for (
    let index = 0;
    index < Math.min(current.length, base.length);
    index += 1
  ) {
    if (current[index] > base[index]) {
      failures.push(
        `${String(current[index])} exceeds baseline ${String(base[index])}`,
      );
    }
  }
  return failures;
}

export function validateRepoPath(path: string): string {
  if (
    path.length === 0 ||
    path.includes("\0") ||
    posix.isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === "." ||
    path.startsWith("../")
  ) {
    throw new Error(`invalid repository-relative path: ${path}`);
  }
  return path;
}

function git(args: readonly string[], cwd: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.signal !== null)
    throw new Error(`git terminated by ${result.signal}`);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  }
  return result.stdout;
}

export function hasHead(root: string): boolean {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", "--quiet", "HEAD"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.error !== undefined) throw result.error;
  if (result.signal !== null)
    throw new Error(`git terminated by ${result.signal}`);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.stderr.trim() || "git rev-parse failed");
}

function renameField(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error("malformed staged rename metadata");
  }
  return value;
}

function addRename(
  fields: readonly string[],
  index: number,
  renames: Map<string, string>,
): void {
  const status = renameField(fields[index]);
  const source = renameField(fields[index + 1]);
  const destination = renameField(fields[index + 2]);
  if (!/^R(?:100|0\d\d)$/u.test(status) || renames.has(destination)) {
    throw new Error("malformed staged rename metadata");
  }
  renames.set(destination, source);
}

export function parseRenameMap(output: string): ReadonlyMap<string, string> {
  const renames = new Map<string, string>();
  if (output.length === 0) return renames;
  if (!output.endsWith("\0")) {
    throw new Error("malformed staged rename metadata");
  }
  const fields = output.slice(0, -1).split("\0");
  if (fields.length % 3 !== 0) {
    throw new Error("malformed staged rename metadata");
  }
  for (let index = 0; index < fields.length; index += 3) {
    addRename(fields, index, renames);
  }
  return renames;
}

export function stagedRenames(root: string): ReadonlyMap<string, string> {
  return parseRenameMap(
    git(
      [
        "diff",
        "--cached",
        "--find-renames",
        "--name-status",
        "-z",
        "--diff-filter=R",
        "--",
      ],
      root,
    ),
  );
}

function blobOid(
  listing: string,
  source: "HEAD" | "index",
  path: string,
): string | undefined {
  if (listing.length === 0) return undefined;
  if (!listing.endsWith("\0")) throw new Error(`malformed ${source} listing`);
  const records = listing.slice(0, -1).split("\0");
  if (records.length !== 1) throw new Error(`ambiguous ${source} listing`);
  const record = records[0];
  if (record === undefined) throw new Error(`malformed ${source} listing`);
  const separator = record.indexOf("\t");
  if (separator < 0) throw new Error(`malformed ${source} listing`);
  const metadata = record.slice(0, separator);
  const listedPath = record.slice(separator + 1);
  const match =
    source === "index"
      ? /^\d{6} ([0-9a-f]{40,64}) 0$/u.exec(metadata)
      : /^\d{6} blob ([0-9a-f]{40,64})$/u.exec(metadata);
  if (match === null) throw new Error(`malformed ${source} listing`);
  const oid = match[1];
  if (oid === undefined) throw new Error(`malformed ${source} listing`);
  if (listedPath !== path) throw new Error(`malformed ${source} listing`);
  return oid;
}

export function readBlob(
  root: string,
  source: "HEAD" | "index",
  path: string,
): string | undefined {
  if (source === "HEAD" && !hasHead(root)) return undefined;
  const literalPath = `:(literal)${path}`;
  const listing =
    source === "index"
      ? git(["ls-files", "--stage", "-z", "--", literalPath], root)
      : git(["ls-tree", "-z", "HEAD", "--", literalPath], root);
  const oid = blobOid(listing, source, path);
  if (oid === undefined) return undefined;
  return git(["cat-file", "blob", oid], root);
}

export async function lintDebt(
  eslint: ESLint,
  code: string,
  path: string,
): Promise<Debt> {
  const [result] = await eslint.lintText(code, {
    filePath: path,
    warnIgnored: false,
  });
  if (result === undefined) return emptyDebt();
  const fatal = result.messages.find((message) => message.fatal === true);
  if (fatal !== undefined) throw new Error(`${path}: ${fatal.message}`);
  return parseDebt(result.messages);
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2).map(validateRepoPath);
  const root = git(["rev-parse", "--show-toplevel"], process.cwd()).trim();
  if (!hasHead(root)) {
    console.log(
      `ESLint debt ratchet: ${String(paths.length)} file(s) held initial baseline`,
    );
    return;
  }
  const renames = stagedRenames(root);
  const eslint = new ESLint({
    cwd: root,
    overrideConfig: {
      rules: {
        complexity: ["error", 10],
        "max-depth": ["error", 4],
        "max-params": ["error", 5],
      },
    },
  });
  const failures: string[] = [];
  for (const path of paths) {
    const current = readBlob(root, "index", path);
    if (current === undefined) continue;
    const base = readBlob(root, "HEAD", renames.get(path) ?? path);
    const currentDebt = await lintDebt(eslint, current, path);
    const baseDebt =
      base === undefined ? emptyDebt() : await lintDebt(eslint, base, path);
    for (const rule of RULES) {
      failures.push(
        ...compareDebt(currentDebt[rule], baseDebt[rule]).map(
          (failure) => `${path} ${rule}: ${failure}`,
        ),
      );
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `ESLint debt ratchet: ${String(paths.length)} file(s) held baseline`,
  );
}

if (process.argv[1]?.endsWith("check-eslint-debt-ratchet.mts")) {
  main().catch((error: unknown) => {
    console.error(
      `ESLint debt ratchet failed:\n${String(error instanceof Error ? error.message : error)}`,
    );
    process.exitCode = 1;
  });
}
