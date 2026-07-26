import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyRepositoryUpgrade,
  planRepositoryUpgrade,
  rollbackRepositoryUpgrade,
  verifyRepositoryUpgrade,
} from "./repository.js";

const roots: string[] = [];
const temp = (name: string): string => {
  const root = mkdtempSync(join(tmpdir(), name));
  roots.push(root);
  return root;
};
const write = (root: string, path: string, value: string): void => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
};
const hash = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const git = (root: string, ...args: string[]): string =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const init = (root: string): void => {
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "user.name", "Upgrade Test");
};
const commit = (root: string, message: string): string => {
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", message);
  return git(root, "rev-parse", "HEAD");
};
const setup = () => {
  const targetRoot = temp("maestro-upgrade-target-");
  const releaseRoot = temp("maestro-upgrade-release-");
  const path = "docs/template/data-resources.json";
  const before = '{"version":1}\n';
  const after = '{"version":2}\n';
  write(
    targetRoot,
    "template-instance.json",
    JSON.stringify({
      schemaVersion: 2,
      release: { version: "0.1.0-alpha.1" },
    }),
  );
  write(targetRoot, path, before);
  init(targetRoot);
  commit(targetRoot, "target fixture");

  init(releaseRoot);
  write(releaseRoot, path, after);
  const sourceCommit = commit(releaseRoot, "release source");
  const base = '{"schemaVersion":1}\n';
  const impactBytes = readFileSync(
    new URL("../../../app-map/fixtures/valid.json", import.meta.url),
  );
  const impactPath = "tooling/app-map/input.json";
  write(releaseRoot, "releases/v0.1.0-alpha.1/manifest.json", base);
  mkdirSync(dirname(join(releaseRoot, impactPath)), { recursive: true });
  writeFileSync(join(releaseRoot, impactPath), impactBytes);
  write(
    releaseRoot,
    "releases/v0.2.0-alpha.1/manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      baseManifest: {
        path: "../v0.1.0-alpha.1/manifest.json",
        sha256: hash(base),
      },
      release: { version: "0.2.0-alpha.1", sourceCommit },
      upgradeImpact: { path: impactPath, sha256: hash(impactBytes) },
      upgrade: {
        schemaVersion: 1,
        transition: {
          id: "template-0.1-to-0.2",
          fromVersion: "0.1.0-alpha.1",
          toVersion: "0.2.0-alpha.1",
          immediatePriorVersion: "0.1.0-alpha.1",
        },
        operations: [
          {
            id: "upgrade-data-resources",
            kind: "modify",
            path,
            ownership: "template-owned",
            beforeHash: hash(before),
            afterHash: hash(after),
          },
        ],
        requirements: [],
      },
    }),
  );
  commit(releaseRoot, "release authority");
  return { targetRoot, releaseRoot, path, before, after };
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("trusted repository upgrade boundary", () => {
  it("recomputes Git, manifest, file, and pinned impact facts", () => {
    const fixture = setup();
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    expect(trusted.plan).toMatchObject({
      ok: true,
      targetClean: true,
      diff: [
        {
          path: fixture.path,
          beforeHash: hash(fixture.before),
          afterHash: hash(fixture.after),
        },
      ],
    });
    expect(trusted.impact).toMatchObject({
      authority: "reviewed-upgrade-plan",
      targetCommit: trusted.plan.targetCommit,
      impact: { complete: true, changedPaths: [fixture.path] },
    });
  });

  it("refuses dirty targets and dirty release authority", () => {
    const fixture = setup();
    write(fixture.targetRoot, "customer.txt", "dirty");
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/UPGRADE_TARGET_DIRTY/);
    rmSync(join(fixture.targetRoot, "customer.txt"));
    write(fixture.releaseRoot, "untrusted.txt", "dirty");
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/authority checkout must be clean/);
  });

  it("refuses an empty reviewed upgrade manifest", () => {
    const fixture = setup();
    const manifestPath = join(
      fixture.releaseRoot,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      upgrade: { operations: unknown[] };
    };
    manifest.upgrade.operations = [];
    writeFileSync(manifestPath, JSON.stringify(manifest));
    commit(fixture.releaseRoot, "empty upgrade authority");
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/no file operations/);
  });

  it("refuses tracked symlinks at reviewed operation paths", () => {
    const fixture = setup();
    rmSync(join(fixture.targetRoot, fixture.path));
    symlinkSync(
      "template-instance.json",
      join(fixture.targetRoot, fixture.path),
    );
    commit(fixture.targetRoot, "tracked symlink");
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/symbolic link/);
  });

  it("stages exact Git source bytes, emits evidence, verifies, and rolls back", () => {
    const fixture = setup();
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    const applied = applyRepositoryUpgrade({
      trusted,
      targetRoot: fixture.targetRoot,
      expectedPlanFingerprint: trusted.plan.planFingerprint,
      write: true,
    });
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.after,
    );
    expect(applied.receipt).toMatchObject({
      status: "applied",
      preUpgradeCommit: trusted.plan.targetCommit,
      promotedPaths: [fixture.path],
    });
    git(fixture.targetRoot, "add", ".");
    git(fixture.targetRoot, "commit", "--quiet", "-m", "upgrade");
    expect(verifyRepositoryUpgrade(applied.receiptPath)).toMatchObject({
      ok: true,
      applied: true,
      verified: true,
    });
    const rollbackReceipt = rollbackRepositoryUpgrade(applied.receiptPath);
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.before,
    );
    expect(JSON.parse(readFileSync(rollbackReceipt, "utf8"))).toMatchObject({
      kind: "maestro-upgrade-rollback",
      planFingerprint: trusted.plan.planFingerprint,
    });
  });

  it("recovers from a durable prepared journal after mutation begins", () => {
    const fixture = setup();
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    const applied = applyRepositoryUpgrade({
      trusted,
      targetRoot: fixture.targetRoot,
      expectedPlanFingerprint: trusted.plan.planFingerprint,
      write: true,
    });
    const transactionPath = join(
      dirname(applied.receiptPath),
      "transaction.json",
    );
    writeFileSync(
      transactionPath,
      JSON.stringify({ ...applied.receipt, status: "prepared" }),
    );
    rollbackRepositoryUpgrade(transactionPath);
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.before,
    );
  });
});
