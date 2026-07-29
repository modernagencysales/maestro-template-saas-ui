import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { HostName } from "./hostInstall.js";
import {
  installVersionedHostProjection,
  recoverInterruptedHostProjection,
  removeVersionedHostProjection,
  rollbackHostProjection,
} from "./hostProjectionLifecycle.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const roots: string[] = [];

const home = async (host: HostName): Promise<string> => {
  const token = host === "claude-code" ? "claude" : "codex";
  const value = await mkdtemp(join(tmpdir(), `maestro-${token}-cp12-`));
  roots.push(value);
  return value;
};

const sourceFixture = async (label: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "maestro-host-source-"));
  roots.push(root);
  await mkdir(root, { recursive: true });
  await cp(join(repoRoot, "agent-pack"), join(root, "agent-pack"), {
    recursive: true,
  });
  const skill = join(root, "agent-pack/skills/maestro/SKILL.md");
  await writeFile(
    skill,
    `${await readFile(skill, "utf8")}\nFixture: ${label}\n`,
  );
  return root;
};

const managedSkill = (homeDir: string, host: HostName): string =>
  join(
    homeDir,
    host === "claude-code" ? ".claude" : ".codex",
    "skills/maestro/SKILL.md",
  );

const stateRoot = (homeDir: string, host: HostName): string =>
  join(
    homeDir,
    host === "claude-code" ? ".claude" : ".codex",
    ".maestro-projection",
  );
const journal = async (
  homeDir: string,
  host: HostName,
): Promise<Record<string, unknown>> =>
  JSON.parse(
    await readFile(join(stateRoot(homeDir, host), "journal.json"), "utf8"),
  ) as Record<string, unknown>;

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe.each(["claude-code", "codex"] as const)(
  "%s versioned host projection lifecycle",
  (host) => {
    it("installs cleanly and is idempotent at the same version", async () => {
      const homeDir = await home(host);
      const receipt = await installVersionedHostProjection({
        host,
        repoRoot,
        homeDir,
        version: "1.0.0",
      });
      const repeated = await installVersionedHostProjection({
        host,
        repoRoot,
        homeDir,
        version: "1.0.0",
      });
      expect(repeated).toEqual(receipt);
      expect(receipt).toMatchObject({
        schemaVersion: 1,
        host,
        version: "1.0.0",
      });
      expect(receipt.files.length).toBeGreaterThan(0);
      expect(await journal(homeDir, host)).toMatchObject({
        status: "CLOSED",
        closure: "committed",
        host,
        homeDir,
        transactionId: receipt.transactionId,
        transactionRoot: join(
          stateRoot(homeDir, host),
          "transactions",
          receipt.transactionId,
        ),
      });
      expect(
        receipt.files.every(
          ({ sourceSha256, installedSha256 }) =>
            sourceSha256 === installedSha256 && sourceSha256.length === 64,
        ),
      ).toBe(true);
      const unmanaged = join(homeDir, "unmanaged.txt");
      await writeFile(unmanaged, "keep\n");
      const removal = await removeVersionedHostProjection(receipt);
      expect(removal.preserved).toEqual([]);
      expect(removal.removed).toHaveLength(receipt.files.length);
      expect(await readFile(unmanaged, "utf8")).toBe("keep\n");
    });

    it("updates one prior version, preserves unmanaged files, and rolls back exactly", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const v2 = await sourceFixture("v2");
      const unmanaged = join(homeDir, "customer-owned.txt");
      await writeFile(unmanaged, "customer\n");
      const first = await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1.0.0",
      });
      const before = await readFile(managedSkill(homeDir, host), "utf8");
      const second = await installVersionedHostProjection({
        host,
        repoRoot: v2,
        homeDir,
        version: "2.0.0",
      });
      expect(await readFile(managedSkill(homeDir, host), "utf8")).toContain(
        "Fixture: v2",
      );
      const restored = await rollbackHostProjection(second);
      expect(restored).toEqual(first);
      expect(await readFile(managedSkill(homeDir, host), "utf8")).toBe(before);
      expect(await readFile(unmanaged, "utf8")).toBe("customer\n");
    }, 15_000);

    it("rejects the same version with changed source authority", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const changed = await sourceFixture("changed");
      await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1.0.0",
      });
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot: changed,
          homeDir,
          version: "1.0.0",
        }),
      ).rejects.toThrow(/version is immutable/);
    });

    it("rejects forged remove receipts without touching auth or config", async () => {
      const homeDir = await home(host);
      const receipt = await installVersionedHostProjection({
        host,
        repoRoot,
        homeDir,
        version: "1",
      });
      const hostRoot = join(
        homeDir,
        host === "claude-code" ? ".claude" : ".codex",
      );
      const auth = join(
        hostRoot,
        host === "claude-code" ? "auth.json" : "config.toml",
      );
      await writeFile(auth, "secret host state\n");
      const forged = {
        ...receipt,
        files: [
          ...receipt.files,
          {
            path: auth,
            sourceSha256: "0".repeat(64),
            installedSha256: "0".repeat(64),
          },
        ],
      };
      await expect(removeVersionedHostProjection(forged)).rejects.toThrow(
        /persisted authority/,
      );
      expect(await readFile(auth, "utf8")).toBe("secret host state\n");

      await writeFile(
        join(stateRoot(homeDir, host), "receipt.json"),
        `${JSON.stringify(forged, null, 2)}\n`,
      );
      await expect(removeVersionedHostProjection(forged)).rejects.toThrow(
        /managed skill root/,
      );
      expect(await readFile(auth, "utf8")).toBe("secret host state\n");
    });

    it("rejects forged or copied recovery authority without touching host state", async () => {
      const homeDir = await home(host);
      const hostRoot = join(
        homeDir,
        host === "claude-code" ? ".claude" : ".codex",
      );
      const auth = join(
        hostRoot,
        host === "claude-code" ? "auth.json" : "config.toml",
      );
      await mkdir(stateRoot(homeDir, host), { recursive: true });
      await writeFile(auth, "secret host state\n");
      await writeFile(
        join(stateRoot(homeDir, host), "journal.json"),
        JSON.stringify({
          schemaVersion: 1,
          kind: "install",
          host,
          homeDir,
          transactionId: "00000000-0000-4000-8000-000000000000",
          backupRoot: join(stateRoot(homeDir, host), "transactions/x/backup"),
          plannedPaths: [auth],
          journalDigest: "0".repeat(64),
        }),
      );
      await expect(
        recoverInterruptedHostProjection({ host, homeDir }),
      ).rejects.toThrow(/journal/);
      expect(await readFile(auth, "utf8")).toBe("secret host state\n");
    });

    it("rejects a receipt copied across host and home authority", async () => {
      const otherHost: HostName =
        host === "claude-code" ? "codex" : "claude-code";
      const sourceHome = await home(otherHost);
      await installVersionedHostProjection({
        host: otherHost,
        repoRoot,
        homeDir: sourceHome,
        version: "1",
      });
      const copied = await readFile(
        join(stateRoot(sourceHome, otherHost), "receipt.json"),
      );
      const targetHome = await home(host);
      await mkdir(stateRoot(targetHome, host), { recursive: true });
      await writeFile(
        join(stateRoot(targetHome, host), "receipt.json"),
        copied,
      );
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot,
          homeDir: targetHome,
          version: "1",
        }),
      ).rejects.toThrow(/receipt authority mismatch/);
    });

    it("refuses modified managed files unless backup-and-replace is explicit", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const v2 = await sourceFixture("v2");
      await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      await writeFile(managedSkill(homeDir, host), "user modification\n");
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot: v2,
          homeDir,
          version: "2",
        }),
      ).rejects.toThrow(/differs|modified/);
      const updated = await installVersionedHostProjection({
        host,
        repoRoot: v2,
        homeDir,
        version: "2",
        modifiedManagedFileResolution: "backup-and-replace",
      });
      await writeFile(managedSkill(homeDir, host), "modified after update\n");
      const removal = await removeVersionedHostProjection(updated);
      expect(removal.preserved).toContain(managedSkill(homeDir, host));
      expect(await readFile(managedSkill(homeDir, host), "utf8")).toBe(
        "modified after update\n",
      );
    });

    it("recovers an injected mid-update failure without a mixed version", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const v2 = await sourceFixture("v2");
      const first = await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      const before = await readFile(managedSkill(homeDir, host), "utf8");
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot: v2,
          homeDir,
          version: "2",
          testFailAfterMutations: 2,
        }),
      ).rejects.toThrow("injected host projection failure");
      expect(await readFile(managedSkill(homeDir, host), "utf8")).toBe(before);
      expect(await journal(homeDir, host)).toMatchObject({
        status: "CLOSED",
        closure: "recovered",
        currentReceiptDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      const repeated = await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      expect(repeated).toEqual(first);
    });
    it.each(["missing", "intermediate-symlink"] as const)(
      "prevalidates an active %s backup before changing recovery targets",
      async (mode) => {
        const homeDir = await home(host);
        const v1 = await sourceFixture(`v1-${mode}`);
        const v2 = await sourceFixture(`v2-${mode}`);
        const current = await installVersionedHostProjection({
          host,
          repoRoot: v1,
          homeDir,
          version: "1",
        });
        await expect(
          installVersionedHostProjection({
            host,
            repoRoot: v2,
            homeDir,
            version: "2",
            testFailAfterMutations: 2,
            testLeaveInterrupted: true,
          }),
        ).rejects.toThrow("injected host projection failure");
        const active = await journal(homeDir, host);
        const backupRoot = active.backupRoot as string;
        const before = await Promise.all(
          current.files.map(
            async (file) => [file.path, await readFile(file.path)] as const,
          ),
        );
        if (mode === "missing") {
          await rm(
            join(backupRoot, relative(homeDir, managedSkill(homeDir, host))),
          );
        } else {
          const outside = await mkdtemp(join(tmpdir(), "maestro-backup-link-"));
          roots.push(outside);
          await rm(backupRoot, { recursive: true });
          await symlink(outside, backupRoot, "dir");
        }
        await expect(
          recoverInterruptedHostProjection({ host, homeDir }),
        ).rejects.toThrow(/backup|symlink|regular/);
        for (const [path, bytes] of before)
          expect(await readFile(path)).toEqual(bytes);
      },
      10_000,
    );

    it("recovers rollback failure at delete and restore boundaries", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const v2 = await sourceFixture("v2");
      await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      const current = await installVersionedHostProjection({
        host,
        repoRoot: v2,
        homeDir,
        version: "2",
      });
      const currentBytes = await readFile(managedSkill(homeDir, host), "utf8");
      for (const boundary of [
        1,
        current.files.length,
        current.files.length + 1,
      ]) {
        await expect(
          rollbackHostProjection(current, {
            testFailAfterMutations: boundary,
          }),
        ).rejects.toThrow("injected host rollback failure");
        expect(await readFile(managedSkill(homeDir, host), "utf8")).toBe(
          currentBytes,
        );
      }
    }, 10_000);

    it("rejects a tampered prior backup before rollback mutation", async () => {
      const homeDir = await home(host);
      const v1 = await sourceFixture("v1");
      const v2 = await sourceFixture("v2");
      await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      const current = await installVersionedHostProjection({
        host,
        repoRoot: v2,
        homeDir,
        version: "2",
      });
      if (!current.rollbackRoot)
        throw new Error("fixture has no rollback root");
      const priorSkillBackup = join(
        current.rollbackRoot,
        "backup",
        relative(homeDir, managedSkill(homeDir, host)),
      );
      await writeFile(priorSkillBackup, "tampered backup\n");
      const before = await readFile(managedSkill(homeDir, host), "utf8");
      await expect(rollbackHostProjection(current)).rejects.toThrow(
        /backup checksum mismatch/,
      );
      expect(await readFile(managedSkill(homeDir, host), "utf8")).toBe(before);
    });

    it("rejects symlinked host roots and source entries", async () => {
      const homeDir = await home(host);
      const token = host === "claude-code" ? ".claude" : ".codex";
      const outside = await mkdtemp(join(tmpdir(), "maestro-host-outside-"));
      roots.push(outside);
      await symlink(outside, join(homeDir, token), "dir");
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot,
          homeDir,
          version: "1",
        }),
      ).rejects.toThrow(/symlink/);

      const safeHome = await home(host);
      const unsafeSource = await sourceFixture("unsafe");
      const external = join(outside, "external.md");
      await writeFile(external, "outside\n");
      await symlink(
        external,
        join(unsafeSource, "agent-pack/skills/maestro/ESCAPE.md"),
      );
      await expect(
        installVersionedHostProjection({
          host,
          repoRoot: unsafeSource,
          homeDir: safeHome,
          version: "1",
        }),
      ).rejects.toThrow(/source contains symlink/);
    });
  },
);
