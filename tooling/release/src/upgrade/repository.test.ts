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
import { buildAppMapImpact } from "@maestro-template/app-map-tooling/impact";
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
const journalHash = (value: Record<string, unknown>): string => {
  const unsigned = { ...value };
  delete unsigned.journalDigest;
  return hash(JSON.stringify(unsigned));
};
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
  const targetCommit = commit(targetRoot, "target fixture");

  init(releaseRoot);
  write(releaseRoot, path, after);
  const sourceCommit = commit(releaseRoot, "release source");
  const tag = "maestro-template-v0.2.0-alpha.1";
  git(releaseRoot, "tag", tag, sourceCommit);
  const sourceChecksum = hash(
    execFileSync("git", [
      "-C",
      releaseRoot,
      "archive",
      "--format=tar",
      sourceCommit,
    ]),
  );
  const base = '{"schemaVersion":1}\n';
  const impactBytes = readFileSync(
    new URL("../../../app-map/fixtures/valid.json", import.meta.url),
  );
  const impactPath = "tooling/app-map/input.json";
  const projectionPath = "tooling/app-map/impact.json";
  const migrationPath = "releases/v0.2.0-alpha.1/migrations/manifest.json";
  write(releaseRoot, "releases/v0.1.0-alpha.1/manifest.json", base);
  mkdirSync(dirname(join(releaseRoot, impactPath)), { recursive: true });
  writeFileSync(join(releaseRoot, impactPath), impactBytes);
  const projected = buildAppMapImpact({
    schemaVersion: 1,
    baseRevision: targetCommit,
    mapInput: JSON.parse(impactBytes.toString("utf8")) as unknown,
    changedPaths: [path],
  });
  if (!projected.ok) throw new Error("Fixture App Map impact failed.");
  const projectionBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      kind: "reviewed-upgrade-impact-coverage",
      baseRevision: targetCommit,
      subjectRevision: sourceCommit,
      structuralPaths: [path],
      ownershipCoveredPaths: [],
      impact: projected.impact,
    }),
  );
  writeFileSync(join(releaseRoot, projectionPath), projectionBytes);
  const migrationBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      transition: {
        id: "template-0.1-to-0.2",
        fromVersion: "0.1.0-alpha.1",
        toVersion: "0.2.0-alpha.1",
      },
      handoff: { migrationId: "fixture-migration" },
      receiptAuthority: { available: false },
    }),
  );
  write(releaseRoot, migrationPath, migrationBytes.toString("utf8"));
  write(
    releaseRoot,
    "releases/v0.2.0-alpha.1/manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      baseManifest: {
        path: "../v0.1.0-alpha.1/manifest.json",
        sha256: hash(base),
      },
      release: {
        version: "0.2.0-alpha.1",
        tag,
        sourceCommit,
        sourceChecksum,
      },
      upgradeImpact: {
        path: impactPath,
        sha256: hash(impactBytes),
        projection: {
          path: projectionPath,
          sha256: hash(projectionBytes),
        },
      },
      migrationHandoff: {
        required: false,
        executionAvailable: false,
        path: migrationPath,
        sha256: hash(migrationBytes),
      },
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
      graph: {
        authority: "reviewed-upgrade-plan",
        targetCommit: trusted.plan.targetCommit,
        impact: { complete: true, changedPaths: [fixture.path] },
      },
      pinned: { complete: true, changedPaths: [fixture.path] },
      ownershipCoveredPaths: [],
    });
    expect(trusted.migration).toMatchObject({
      required: false,
      executionAvailable: false,
      transitionId: "template-0.1-to-0.2",
      migrationId: "fixture-migration",
      fileUpgradePlanFingerprint: trusted.plan.planFingerprint,
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

  it("refuses symbolic-link roots and apply targets other than the planned repository", () => {
    const fixture = setup();
    const linkedParent = temp("maestro-upgrade-linked-root-");
    const linkedTarget = join(linkedParent, "target");
    const linkedRelease = join(linkedParent, "release");
    symlinkSync(fixture.targetRoot, linkedTarget);
    symlinkSync(fixture.releaseRoot, linkedRelease);
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: linkedTarget,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/canonical path/);
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: linkedRelease,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/canonical path/);
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    const otherTarget = temp("maestro-upgrade-other-target-");
    execFileSync("git", ["clone", "--quiet", fixture.targetRoot, otherTarget]);
    const forged = { ...trusted, targetRoot: otherTarget };
    expect(() =>
      applyRepositoryUpgrade({
        trusted: forged,
        targetRoot: otherTarget,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedAuthorityFingerprint: trusted.authorityFingerprint,
        write: true,
      }),
    ).toThrow(/authority changed/);
    expect(readFileSync(join(otherTarget, fixture.path), "utf8")).toBe(
      fixture.before,
    );
  });

  it("binds the release tag and source archive checksum", () => {
    const fixture = setup();
    const manifestPath = join(
      fixture.releaseRoot,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      release: { sourceChecksum: string };
    };
    manifest.release.sourceChecksum = `sha256:${"0".repeat(64)}`;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    commit(fixture.releaseRoot, "tampered archive checksum");
    expect(() =>
      planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      }),
    ).toThrow(/archive checksum/);
  });
  it("plans from commit authority without a tag but blocks apply before writes", () => {
    const fixture = setup();
    git(fixture.releaseRoot, "tag", "-d", "maestro-template-v0.2.0-alpha.1");
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    expect(trusted.plan.ok).toBe(true);
    expect(() =>
      applyRepositoryUpgrade({
        trusted,
        targetRoot: fixture.targetRoot,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedAuthorityFingerprint: trusted.authorityFingerprint,
        write: true,
      }),
    ).toThrow(/external immutable release tag/);
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.before,
    );
  });
  it("derives required migration from release authority and blocks apply before writes", () => {
    const fixture = setup();
    const manifestPath = join(
      fixture.releaseRoot,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      migrationHandoff: { required: boolean };
    };
    manifest.migrationHandoff.required = true;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    commit(fixture.releaseRoot, "require migration receipt");
    const trusted = planRepositoryUpgrade({
      targetRoot: fixture.targetRoot,
      releaseRoot: fixture.releaseRoot,
      toVersion: "0.2.0-alpha.1",
    });
    expect(trusted.migration.required).toBe(true);
    expect(() =>
      applyRepositoryUpgrade({
        trusted,
        targetRoot: fixture.targetRoot,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedAuthorityFingerprint: trusted.authorityFingerprint,
        write: true,
      }),
    ).toThrow(/externally trusted, release-bound migration receipt/);
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.before,
    );
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
      expectedAuthorityFingerprint: trusted.authorityFingerprint,
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
    expect(
      verifyRepositoryUpgrade({
        receiptPath: applied.receiptPath,
        targetRoot: fixture.targetRoot,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedJournalDigest: applied.receipt.journalDigest,
      }),
    ).toMatchObject({
      ok: false,
      applied: false,
      verified: false,
      resolutions: expect.arrayContaining([
        expect.objectContaining({ code: "UPGRADE_VERIFY_TARGET_DIRTY" }),
        expect.objectContaining({ code: "UPGRADE_VERIFY_COMMIT_NOT_ADVANCED" }),
      ]),
    });
    git(fixture.targetRoot, "add", ".");
    git(fixture.targetRoot, "commit", "--quiet", "-m", "upgrade");
    expect(
      verifyRepositoryUpgrade({
        receiptPath: applied.receiptPath,
        targetRoot: fixture.targetRoot,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedJournalDigest: applied.receipt.journalDigest,
      }),
    ).toMatchObject({
      ok: true,
      applied: true,
      verified: true,
    });
    const rollbackReceipt = rollbackRepositoryUpgrade({
      receiptPath: applied.receiptPath,
      targetRoot: fixture.targetRoot,
      expectedPlanFingerprint: trusted.plan.planFingerprint,
      expectedJournalDigest: applied.receipt.journalDigest,
      write: true,
    });
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
      expectedAuthorityFingerprint: trusted.authorityFingerprint,
      write: true,
    });
    const transactionPath = join(
      dirname(applied.receiptPath),
      "transaction.json",
    );
    const prepared = { ...applied.receipt, status: "prepared" } as Record<
      string,
      unknown
    >;
    prepared.journalDigest = journalHash(prepared);
    writeFileSync(transactionPath, JSON.stringify(prepared));
    rollbackRepositoryUpgrade({
      receiptPath: transactionPath,
      targetRoot: fixture.targetRoot,
      expectedPlanFingerprint: trusted.plan.planFingerprint,
      expectedJournalDigest: String(prepared.journalDigest),
      write: true,
    });
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.before,
    );
  });

  it.each(["old-to-backup", "stage-to-destination"] as const)(
    "restores the target after an injected %s boundary failure",
    (boundary) => {
      const fixture = setup();
      const trusted = planRepositoryUpgrade({
        targetRoot: fixture.targetRoot,
        releaseRoot: fixture.releaseRoot,
        toVersion: "0.2.0-alpha.1",
      });
      expect(() =>
        applyRepositoryUpgrade({
          trusted,
          targetRoot: fixture.targetRoot,
          expectedPlanFingerprint: trusted.plan.planFingerprint,
          expectedAuthorityFingerprint: trusted.authorityFingerprint,
          write: true,
          onMutationBoundary: (observed) => {
            if (observed === boundary) throw new Error(`injected ${boundary}`);
          },
        }),
      ).toThrow(`injected ${boundary}`);
      expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
        fixture.before,
      );
    },
  );

  it("rejects every mutable rollback authority field before any write", () => {
    const cases = [
      "targetRoot",
      "backupRoot",
      "operationPath",
      "planInput",
      "planFingerprint",
      "releaseManifestHash",
    ] as const;
    for (const field of cases) {
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
        expectedAuthorityFingerprint: trusted.authorityFingerprint,
        write: true,
      });
      const victimRoot = temp("maestro-upgrade-victim-");
      write(victimRoot, "victim.txt", "untouched\n");
      const receipt = JSON.parse(readFileSync(applied.receiptPath, "utf8")) as {
        targetRoot: string;
        backupRoot: string;
        planFingerprint: string;
        releaseManifestHash: string;
        planInput: {
          target: { clean: boolean };
          manifest: { operations: Array<{ path: string }> };
        };
      };
      if (field === "targetRoot") receipt.targetRoot = victimRoot;
      if (field === "backupRoot")
        receipt.backupRoot = join(victimRoot, "backup");
      if (field === "operationPath") {
        const [operation] = receipt.planInput.manifest.operations;
        if (!operation) throw new Error("Expected reviewed fixture operation.");
        operation.path = "victim.txt";
      }
      if (field === "planInput") receipt.planInput.target.clean = false;
      if (field === "planFingerprint")
        receipt.planFingerprint = `sha256:${"0".repeat(64)}`;
      if (field === "releaseManifestHash")
        receipt.releaseManifestHash = `sha256:${"0".repeat(64)}`;
      writeFileSync(applied.receiptPath, JSON.stringify(receipt));
      if (field === "targetRoot")
        expect(() =>
          verifyRepositoryUpgrade({
            receiptPath: applied.receiptPath,
            targetRoot: fixture.targetRoot,
            expectedPlanFingerprint: trusted.plan.planFingerprint,
            expectedJournalDigest: applied.receipt.journalDigest,
          }),
        ).toThrow();
      expect(() =>
        rollbackRepositoryUpgrade({
          receiptPath: applied.receiptPath,
          targetRoot: fixture.targetRoot,
          expectedPlanFingerprint: trusted.plan.planFingerprint,
          expectedJournalDigest: applied.receipt.journalDigest,
          write: true,
        }),
      ).toThrow();
      expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
        fixture.after,
      );
      expect(readFileSync(join(victimRoot, "victim.txt"), "utf8")).toBe(
        "untouched\n",
      );
    }
  }, 15_000);

  it("rejects tampered backup bytes and post-apply user edits before rollback", () => {
    for (const field of ["backup", "target"] as const) {
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
        expectedAuthorityFingerprint: trusted.authorityFingerprint,
        write: true,
      });
      const changedPath =
        field === "backup"
          ? join(applied.receipt.backupRoot, fixture.path)
          : join(fixture.targetRoot, fixture.path);
      writeFileSync(changedPath, "unreviewed\n");
      expect(() =>
        rollbackRepositoryUpgrade({
          receiptPath: applied.receiptPath,
          targetRoot: fixture.targetRoot,
          expectedPlanFingerprint: trusted.plan.planFingerprint,
          expectedJournalDigest: applied.receipt.journalDigest,
          write: true,
        }),
      ).toThrow(/bytes/);
      expect(readFileSync(changedPath, "utf8")).toBe("unreviewed\n");
    }
  });

  it("rejects a valid journal copied outside its target transaction location", () => {
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
      expectedAuthorityFingerprint: trusted.authorityFingerprint,
      write: true,
    });
    const copiedRoot = temp("maestro-upgrade-copied-journal-");
    const copiedReceipt = join(copiedRoot, "apply-receipt.json");
    writeFileSync(copiedReceipt, readFileSync(applied.receiptPath));
    expect(() =>
      rollbackRepositoryUpgrade({
        receiptPath: copiedReceipt,
        targetRoot: fixture.targetRoot,
        expectedPlanFingerprint: trusted.plan.planFingerprint,
        expectedJournalDigest: applied.receipt.journalDigest,
        write: true,
      }),
    ).toThrow(/transaction location/);
    expect(readFileSync(join(fixture.targetRoot, fixture.path), "utf8")).toBe(
      fixture.after,
    );
  });
});
