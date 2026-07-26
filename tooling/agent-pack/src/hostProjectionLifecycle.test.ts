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
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { HostName } from "./hostInstall.js";
import {
  installVersionedHostProjection,
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
      const repeated = await installVersionedHostProjection({
        host,
        repoRoot: v1,
        homeDir,
        version: "1",
      });
      expect(repeated).toEqual(first);
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
