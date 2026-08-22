import { execFile, execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  createSourceFile,
  isFunctionDeclaration,
  type FunctionDeclaration,
  type SourceFile,
  ScriptTarget,
} from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const compatibilitySets = [
  {
    name: "current",
    convex: "1.42.1",
    workflow: "0.4.4",
    workpool: "0.4.7",
  },
  {
    name: "candidate",
    convex: "1.42.3",
    workflow: "0.4.4",
    workpool: "0.4.8",
  },
] as const;

type CompatibilitySet = (typeof compatibilitySets)[number];

const installations = new Map<CompatibilitySet["name"], string>();
const repoRoot = resolve(import.meta.dirname, "../../..");
const execFileAsync = promisify(execFile);

const diagnosticText = (value: unknown): string => {
  if (typeof value === "string") return value.trimEnd();
  if (Buffer.isBuffer(value)) return value.toString("utf8").trimEnd();
  return "(none)";
};

const pnpmFailureMessage = (error: unknown): string => {
  const failure = error as {
    readonly code?: number | string | null;
    readonly signal?: NodeJS.Signals | null;
    readonly stdout?: unknown;
    readonly stderr?: unknown;
  };
  return [
    `pnpm failed (code=${failure.code ?? "unknown"}, signal=${failure.signal ?? "none"})`,
    "stdout:",
    diagnosticText(failure.stdout),
    "stderr:",
    diagnosticText(failure.stderr),
  ].join("\n");
};

it("preserves pnpm child failure diagnostics", () => {
  expect(
    pnpmFailureMessage({
      code: 1,
      signal: null,
      stdout: "captured stdout",
      stderr: "captured stderr",
    }),
  ).toBe(
    "pnpm failed (code=1, signal=none)\nstdout:\ncaptured stdout\nstderr:\ncaptured stderr",
  );
});

it("approves isolated Vitest builds through pnpm 11 workspace settings", () => {
  expect(compatibilityWorkspace()).toBe(
    "packages: []\nallowBuilds:\n  esbuild: true\n",
  );
});

const runPnpm = (root: string, ...args: readonly string[]): string =>
  execFileSync("pnpm", [...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });

const runPnpmAsync = async (
  root: string,
  ...args: readonly string[]
): Promise<void> => {
  try {
    await execFileAsync("pnpm", [...args], {
      cwd: root,
      encoding: "utf8",
    });
  } catch (error) {
    throw new Error(pnpmFailureMessage(error), { cause: error });
  }
};

const compatibilityPackage = (set: CompatibilitySet) => ({
  name: `maestro-workpool-${set.workpool}-proof`,
  private: true,
  dependencies: {
    "@convex-dev/workflow": set.workflow,
    "@convex-dev/workpool": set.workpool,
    convex: set.convex,
    "convex-helpers": "0.1.111",
    "convex-test": "0.0.54",
  },
  devDependencies: {
    vitest: "3.2.6",
  },
});

const compatibilityWorkspace = (): string =>
  "packages: []\nallowBuilds:\n  esbuild: true\n";

describe("isolated Workpool compatibility behavior", () => {
  beforeAll(async () => {
    for (const set of compatibilitySets) {
      const root = mkdtempSync(
        join(tmpdir(), `maestro-workpool-${set.workpool.replaceAll(".", "")}-`),
      );
      installations.set(set.name, root);
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify(compatibilityPackage(set)),
      );
      writeFileSync(
        join(root, "pnpm-workspace.yaml"),
        compatibilityWorkspace(),
      );
      await runPnpmAsync(root, "install", "--lockfile-only");
      await runPnpmAsync(root, "install", "--frozen-lockfile");

      cpSync(
        join(root, "node_modules/@convex-dev/workpool/src"),
        join(root, "workpool-source"),
        { recursive: true },
      );
    }
  }, 120_000);

  afterAll(() => {
    for (const root of installations.values()) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(compatibilitySets)(
    "$name resolves the exact engine set through a fresh frozen install",
    (set) => {
      const root = installation(set.name);
      const matrix = JSON.parse(
        readFileSync(
          resolve(repoRoot, "docs/template/convex-compatibility.json"),
          "utf8",
        ),
      ) as {
        readonly current: Readonly<Record<string, string>>;
        readonly candidate: Readonly<Record<string, string>>;
        readonly workpoolSafety: Readonly<
          Record<
            CompatibilitySet["name"],
            {
              readonly version: string;
              readonly productionSupport: string;
              readonly behavioralOutcomes: Readonly<Record<string, string>>;
            }
          >
        >;
      };
      const authority = matrix[set.name];
      const safety = matrix.workpoolSafety[set.name];
      const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
      const installed = JSON.parse(
        readFileSync(
          join(root, "node_modules/@convex-dev/workpool/package.json"),
          "utf8",
        ),
      ) as { readonly version?: string };
      expect(installed.version).toBe(set.workpool);
      expect(authority.convex).toBe(set.convex);
      expect(authority["@convex-dev/workflow"]).toBe(set.workflow);
      expect(authority["@convex-dev/workpool"]).toBe(set.workpool);
      expect(safety).toMatchObject({
        version: set.workpool,
        productionSupport: "unsupported",
        behavioralOutcomes: {
          "WF-WORKPOOL-DUPLICATE-COMPLETION":
            "unsafe-attempt-mutated-before-pending-completion-dedup",
          "WF-WORKPOOL-CANCEL-RACE": "unsafe-concurrent-double-delete",
        },
      });
      expect(lock).toContain("'@convex-dev/workpool':");
      expect(lock).toContain(`specifier: ${set.workpool}`);
      expect(lock).toContain(`specifier: ${set.workflow}`);
      expect(lock).toContain(`specifier: ${set.convex}`);
    },
  );

  it.each(compatibilitySets)(
    "$name behaviorally reproduces both unsafe Workpool race outcomes",
    (set) => {
      const root = installation(set.name);
      const output = runPnpm(
        root,
        "exec",
        "vitest",
        "run",
        "workpool-source/component/stateMachine.test.ts",
        "--maxWorkers=1",
        "--no-file-parallelism",
        "--reporter=verbose",
        "-t",
        "duplicate complete with correct attempt|multiple cancels for same work",
      );
      expect(output).toContain("2 passed");
      expect(output).toContain("duplicate complete with correct attempt");
      expect(output).toContain("multiple cancels for same work");
    },
    60_000,
  );

  it.each(compatibilitySets)(
    "$name source order explains the observed duplicate completion mutation",
    (set) => {
      const source = packageSource(set.name, "complete.ts");
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
    },
  );

  it.each(compatibilitySets)(
    "$name source order explains the observed duplicate cancellation race",
    (set) => {
      const source = packageSource(set.name, "loop.ts");
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
    },
  );
});

const installation = (name: CompatibilitySet["name"]): string => {
  const root = installations.get(name);
  if (root === undefined) throw new Error(`missing ${name} installation`);
  return root;
};

const packageSource = (
  name: CompatibilitySet["name"],
  file: string,
): SourceFile => {
  const path = join(
    installation(name),
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
