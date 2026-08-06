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

function readBlob(
  root: string,
  source: "HEAD" | "index",
  path: string,
): string | undefined {
  const listing =
    source === "index"
      ? git(["ls-files", "--stage", "--", path], root)
      : git(["ls-tree", "-z", "HEAD", "--", path], root);
  if (listing.length === 0) return undefined;
  return git(["show", source === "index" ? `:${path}` : `HEAD:${path}`], root);
}

async function lintDebt(
  eslint: ESLint,
  code: string,
  path: string,
): Promise<Debt> {
  const [result] = await eslint.lintText(code, {
    filePath: path,
    warnIgnored: false,
  });
  if (result === undefined)
    throw new Error(`ESLint returned no result for ${path}`);
  const fatal = result.messages.find((message) => message.fatal === true);
  if (fatal !== undefined) throw new Error(`${path}: ${fatal.message}`);
  return parseDebt(result.messages);
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2).map(validateRepoPath);
  const root = git(["rev-parse", "--show-toplevel"], process.cwd()).trim();
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
    const base = readBlob(root, "HEAD", path);
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
