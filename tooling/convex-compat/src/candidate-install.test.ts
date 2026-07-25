import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSourceFile,
  isFunctionDeclaration,
  type FunctionDeclaration,
  type SourceFile,
  ScriptTarget,
} from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const candidateRoot = mkdtempSync(join(tmpdir(), "maestro-workpool-048-"));

const runPnpm = (...args: readonly string[]): void => {
  execFileSync("pnpm", [...args], {
    cwd: candidateRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
};

describe("isolated Workpool 0.4.8 candidate", () => {
  beforeAll(() => {
    writeFileSync(
      join(candidateRoot, "package.json"),
      JSON.stringify({
        name: "maestro-workpool-048-proof",
        private: true,
        dependencies: {
          "@convex-dev/workflow": "0.4.4",
          "@convex-dev/workpool": "0.4.8",
          convex: "1.42.3",
          "convex-test": "0.0.54",
        },
      }),
    );
    runPnpm("install", "--ignore-workspace", "--lockfile-only");
    runPnpm("install", "--ignore-workspace", "--frozen-lockfile");
  }, 120_000);

  afterAll(() => rmSync(candidateRoot, { recursive: true, force: true }));

  it("resolves the exact candidate set through a fresh frozen install", () => {
    const lock = readFileSync(join(candidateRoot, "pnpm-lock.yaml"), "utf8");
    const installed = JSON.parse(
      readFileSync(
        join(candidateRoot, "node_modules/@convex-dev/workpool/package.json"),
        "utf8",
      ),
    ) as { readonly version?: string };
    expect(installed.version).toBe("0.4.8");
    expect(lock).toContain("'@convex-dev/workpool':");
    expect(lock).toContain("specifier: 0.4.8");
    expect(lock).toContain("specifier: 1.42.3");
  });

  it("proves duplicate completion mutates attempts before deduplication", () => {
    const source = candidateSource("complete.ts");
    const handler = functionSource(source, "completeHandler");
    const increment = requiredIndex(handler, "work.attempts++");
    const persistedIncrement = requiredIndex(
      handler,
      'ctx.db.patch("work", work._id, { attempts: work.attempts })',
    );
    const dedupQuery = requiredIndex(handler, '.query("pendingCompletion")');
    const dedupGuard = requiredIndex(handler, "if (pendingCompletion)");

    expect(increment).toBeLessThan(persistedIncrement);
    expect(persistedIncrement).toBeLessThan(dedupQuery);
    expect(dedupQuery).toBeLessThan(dedupGuard);
  });

  it("proves duplicate cancellations race before the shared guard is set", () => {
    const source = candidateSource("loop.ts");
    const handler = functionSource(source, "handleCancelation");
    const concurrentDispatch = requiredIndex(handler, "await Promise.all(");
    const concurrentMap = requiredIndex(handler, "canceled.map(async");
    const initialGuard = requiredIndex(handler, "canceledWork.has(workId)");
    const firstAwaitAfterGuard = requiredIndex(
      handler,
      'await ctx.db.get("work", workId)',
    );
    const pendingStartDelete = requiredIndex(
      handler,
      'await ctx.db.delete("pendingStart", pendingStart._id)',
    );
    const guardMutation = requiredIndex(handler, "canceledWork.add(workId)");

    expect(concurrentDispatch).toBeLessThan(concurrentMap);
    expect(concurrentMap).toBeLessThan(initialGuard);
    expect(initialGuard).toBeLessThan(firstAwaitAfterGuard);
    expect(firstAwaitAfterGuard).toBeLessThan(pendingStartDelete);
    expect(pendingStartDelete).toBeLessThan(guardMutation);
  });
});

const candidateSource = (file: string): SourceFile => {
  const path = join(
    candidateRoot,
    "node_modules/@convex-dev/workpool/src/component",
    file,
  );
  return createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ScriptTarget.Latest,
    true,
  );
};

const functionSource = (source: SourceFile, name: string): string => {
  const declaration = source.statements.find(
    (statement): statement is FunctionDeclaration =>
      isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declaration === undefined) {
    throw new Error(`${source.fileName}: missing function ${name}`);
  }
  return declaration.getText(source);
};

const requiredIndex = (source: string, fragment: string): number => {
  const index = source.indexOf(fragment);
  expect(index, fragment).toBeGreaterThanOrEqual(0);
  return index;
};
