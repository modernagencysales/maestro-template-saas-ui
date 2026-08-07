import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRepositoryContext } from "./repoContext.js";
import {
  createNodeRecipeTransaction,
  recoverRecipeTransaction,
} from "./recipeTransaction.js";
import {
  fingerprintRecipePlan,
  sha256RecipeBytes,
  type RecipeExecutionPlan,
} from "./recipes.js";

const fixture = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "maestro-recipe-")));
  mkdirSync(join(root, "catalog"));
  writeFileSync(join(root, "catalog/data.json"), "old\n");
  const unsigned = {
    schemaVersion: 1 as const,
    recipeId: "crud-business-entity",
    recipeSchemaVersion: 2,
    recipeExecutionVersion: 1,
    targetRoot: root,
    steps: [
      {
        id: "durable-table",
        generatorId: "add-table",
        args: { name: "Request" },
        generatorVersion: "add-table@1",
      },
    ],
    operations: [
      {
        path: "catalog/data.json",
        content: "new\n",
        contentSha256: sha256RecipeBytes("new\n"),
        beforeSha256: sha256RecipeBytes("old\n"),
        generatorStepId: "durable-table",
      },
      {
        path: "feature/request.ts",
        content: "export const request = true;\n",
        contentSha256: sha256RecipeBytes("export const request = true;\n"),
        beforeSha256: null,
        generatorStepId: "durable-table",
      },
      {
        path: "reports/request.ts",
        content: "export const requestReport = true;\n",
        contentSha256: sha256RecipeBytes(
          "export const requestReport = true;\n",
        ),
        beforeSha256: null,
        generatorStepId: "durable-table",
      },
    ],
    collisions: [],
    provenancePaths: ["feature/request.ts"],
    semanticRuleIds: [],
    codegen: [],
    focusedGates: [],
  };
  const plan: RecipeExecutionPlan = {
    ...unsigned,
    fingerprint: fingerprintRecipePlan(unsigned),
  };
  return {
    root,
    plan,
    request: {
      repo: createRepositoryContext({ cwd: root }),
      plan,
      preflightFingerprint: "preflight_sha256:fixture",
      answersSha256: sha256RecipeBytes("answers"),
    },
  };
};

const planRoot = (value: ReturnType<typeof fixture>) =>
  join(
    value.root,
    ".maestro/recipe-transactions",
    value.plan.fingerprint.replace(/[^a-zA-Z0-9]/gu, "-"),
  );
const attemptRoot = (value: ReturnType<typeof fixture>, number = 1) =>
  join(planRoot(value), `attempt-${String(number).padStart(4, "0")}`);
const rewriteCleanupAuthority = (
  value: ReturnType<typeof fixture>,
  mutate: (directories: string[]) => string[],
) => {
  const journalPath = join(attemptRoot(value), "transaction.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
    string,
    unknown
  > & { actualCreatedDirectories: string[] };
  journal.actualCreatedDirectories = mutate([
    ...journal.actualCreatedDirectories,
  ]);
  delete journal.journalDigest;
  journal.journalDigest = sha256RecipeBytes(JSON.stringify(journal));
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
};

describe("atomic recipe transaction", () => {
  it("applies replacements and creates in one journaled receipt", async () => {
    const value = fixture();
    const result = await createNodeRecipeTransaction().apply(value.request);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        kind: "maestro-recipe-transaction",
        planFingerprint: value.plan.fingerprint,
      },
    });
    expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
      "new\n",
    );
    expect(
      readFileSync(join(value.root, "feature/request.ts"), "utf8"),
    ).toContain("request");
  });

  it("rolls back every applied operation when a later step fails", async () => {
    const value = fixture();
    const result = await createNodeRecipeTransaction({
      failAfterOperation: 2,
    }).apply(value.request);
    expect(result).toMatchObject({ ok: false });
    expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
      "old\n",
    );
    expect(() =>
      readFileSync(join(value.root, "feature/request.ts")),
    ).toThrow();
  });

  it("preserves a pre-existing empty operation parent through rollback and recovery", async () => {
    const rolledBack = fixture();
    mkdirSync(join(rolledBack.root, "feature"));
    await expect(
      createNodeRecipeTransaction({ failAfterOperation: 2 }).apply(
        rolledBack.request,
      ),
    ).resolves.toMatchObject({ ok: false });
    expect(readdirSync(join(rolledBack.root, "feature"))).toEqual([]);
    expect(
      readFileSync(join(rolledBack.root, "catalog/data.json"), "utf8"),
    ).toBe("old\n");

    const recovered = fixture();
    mkdirSync(join(recovered.root, "feature"));
    await createNodeRecipeTransaction({
      crashAt: "after-install-rename-before-journal",
      crashAtOperation: 2,
    }).apply(recovered.request);
    expect(recoverRecipeTransaction(recovered.request)).toMatchObject({
      ok: true,
      recoveredAttempts: 1,
    });
    expect(readdirSync(join(recovered.root, "feature"))).toEqual([]);
    expect(
      readFileSync(join(recovered.root, "catalog/data.json"), "utf8"),
    ).toBe("old\n");
  });

  it("cleans only earlier attempt-created parents when a later missing parent appears externally", async () => {
    const value = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-installed-journal",
      crashAtOperation: 2,
    }).apply(value.request);
    const laterParent = join(value.root, "reports");
    mkdirSync(laterParent);

    expect(recoverRecipeTransaction(value.request)).toMatchObject({
      ok: true,
      recoveredAttempts: 1,
    });
    expect(existsSync(join(value.root, "feature"))).toBe(false);
    expect(readdirSync(laterParent)).toEqual([]);
    expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
      "old\n",
    );
  });

  it.each([
    "after-backup-rename-before-journal",
    "after-install-rename-before-journal",
    "after-installed-journal",
  ] as const)(
    "recovers the exact preimage from crash window %s",
    async (crashAt) => {
      const value = fixture();
      await expect(
        createNodeRecipeTransaction({ crashAt }).apply(value.request),
      ).resolves.toMatchObject({
        ok: false,
        message: expect.stringMatching(/Injected process crash/),
      });

      expect(recoverRecipeTransaction(value.request)).toMatchObject({
        ok: true,
        recoveredAttempts: 1,
      });
      expect(readFileSync(join(value.root, "catalog/data.json"), "utf8")).toBe(
        "old\n",
      );
      expect(() =>
        readFileSync(join(value.root, "feature/request.ts")),
      ).toThrow();
      expect(recoverRecipeTransaction(value.request)).toEqual({
        ok: true,
        recoveredAttempts: 0,
      });
    },
  );

  it("retains recovered evidence and retries in the next numbered attempt", async () => {
    const value = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-install-rename-before-journal",
    }).apply(value.request);

    await expect(
      createNodeRecipeTransaction().apply(value.request),
    ).resolves.toMatchObject({ ok: true });
    expect(readdirSync(planRoot(value)).sort()).toEqual([
      "attempt-0001",
      "attempt-0002",
    ]);
    expect(
      JSON.parse(
        readFileSync(join(attemptRoot(value), "transaction.json"), "utf8"),
      ),
    ).toMatchObject({ status: "rolled-back" });
    expect(
      JSON.parse(
        readFileSync(join(attemptRoot(value, 2), "transaction.json"), "utf8"),
      ),
    ).toMatchObject({ status: "applied" });
  });

  it("rejects tampered journals and backups instead of guessing", async () => {
    const journalTamper = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-backup-rename-before-journal",
    }).apply(journalTamper.request);
    const journalPath = join(attemptRoot(journalTamper), "transaction.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      status: string;
    };
    journal.status = "rolled-back";
    writeFileSync(journalPath, `${JSON.stringify(journal)}\n`);
    expect(recoverRecipeTransaction(journalTamper.request)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/authentication failed/),
    });

    const backupTamper = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-backup-rename-before-journal",
    }).apply(backupTamper.request);
    writeFileSync(
      join(attemptRoot(backupTamper), "backup/catalog/data.json"),
      "tampered\n",
    );
    expect(recoverRecipeTransaction(backupTamper.request)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/mechanically prove/),
    });
  });

  it("rejects copied journals with the wrong roots and recovery symlinks", async () => {
    const source = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-backup-rename-before-journal",
    }).apply(source.request);
    const copied = fixture();
    mkdirSync(planRoot(copied), { recursive: true });
    cpSync(attemptRoot(source), attemptRoot(copied), { recursive: true });
    expect(recoverRecipeTransaction(copied.request)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/exact reviewed authority/),
    });

    const symlink = fixture();
    await createNodeRecipeTransaction({
      crashAt: "after-backup-rename-before-journal",
    }).apply(symlink.request);
    const backup = join(attemptRoot(symlink), "backup/catalog/data.json");
    const outside = join(symlink.root, "outside-backup");
    writeFileSync(outside, "old\n");
    unlinkSync(backup);
    symlinkSync(outside, backup);
    expect(recoverRecipeTransaction(symlink.request)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/symlink|not a regular file/),
    });
  });

  it.each([
    {
      name: "an unrelated in-target directory",
      mutate: (directories: string[]) => [...directories, "unrelated-empty"],
    },
    {
      name: "reordered entries",
      mutate: (directories: string[]) => directories.reverse(),
    },
    {
      name: "a duplicate entry",
      mutate: (directories: string[]) => {
        const [first] = directories;
        return first === undefined ? directories : [first, ...directories];
      },
    },
    {
      name: "an unreviewed parent entry",
      mutate: (directories: string[]) => [".maestro", ...directories],
    },
  ])(
    "rejects recomputed-digest cleanup authority with $name before mutation",
    async ({ mutate }) => {
      const value = fixture();
      const unrelated = join(value.root, "unrelated-empty");
      const untouched = join(value.root, "untouched.txt");
      mkdirSync(unrelated);
      writeFileSync(untouched, "untouched bytes\n");
      await createNodeRecipeTransaction({
        crashAt: "after-install-rename-before-journal",
        crashAtOperation: 3,
      }).apply(value.request);
      const partialTargetBytes = readFileSync(
        join(value.root, "catalog/data.json"),
      );
      const untouchedBytes = readFileSync(untouched);

      rewriteCleanupAuthority(value, mutate);

      expect(recoverRecipeTransaction(value.request)).toMatchObject({
        ok: false,
        message: expect.stringMatching(/cleanup directory authority/),
      });
      expect(readFileSync(join(value.root, "catalog/data.json"))).toEqual(
        partialTargetBytes,
      );
      expect(readFileSync(untouched)).toEqual(untouchedBytes);
      expect(readdirSync(unrelated)).toEqual([]);
    },
  );

  it("fails closed on target drift, replay, and symlink traversal", async () => {
    const drift = fixture();
    writeFileSync(join(drift.root, "catalog/data.json"), "drift\n");
    await expect(
      createNodeRecipeTransaction().apply(drift.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/drifted after preview/),
    });
    expect(existsSync(join(drift.root, ".maestro"))).toBe(false);

    const replay = fixture();
    await createNodeRecipeTransaction().apply(replay.request);
    await expect(
      createNodeRecipeTransaction().apply(replay.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/replay/),
    });

    const symlink = fixture();
    mkdirSync(join(symlink.root, "outside"));
    symlinkSync(join(symlink.root, "outside"), join(symlink.root, "feature"));
    await expect(
      createNodeRecipeTransaction().apply(symlink.request),
    ).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/symlink/),
    });
  });
});
