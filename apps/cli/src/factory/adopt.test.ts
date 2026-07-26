import { readFileSync } from "node:fs";
import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAdoptCliHandler } from "./adopt";
import { readBoundedAdoptionPacket } from "./adoptFileReader";

const sha = (value: string) => value.repeat(40);
const authority = {
  mode: "separate-target",
  sourceReadOnly: true,
  source: {
    requestedRoot: "/repo/source",
    resolvedRoot: "/repo/source",
    worktreeRoot: "/repo/source",
    exists: true,
    empty: false,
    clean: true,
    revision: sha("1"),
  },
  target: {
    requestedRoot: "/repo/target",
    resolvedRoot: "/repo/target",
    worktreeRoot: null,
    exists: false,
    empty: null,
    clean: null,
    revision: null,
  },
  baseline: { sourceRevision: sha("1"), targetRevision: null },
  template: {
    requestedRoot: "/release/v1",
    resolvedRoot: "/release/v1",
    tag: "v1",
    commit: sha("2"),
    archiveChecksum: `sha256:${"a".repeat(64)}`,
    manifestChecksum: `sha256:${"b".repeat(64)}`,
  },
  reviewedTemplate: {
    tag: "v1",
    commit: sha("2"),
    archiveChecksum: `sha256:${"a".repeat(64)}`,
    manifestChecksum: `sha256:${"b".repeat(64)}`,
  },
  protectedRoots: [{ label: "factory", resolvedRoot: "/factory" }],
};

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../../tooling/agent-pack/__fixtures__/adoption/separate-target.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Record<string, unknown>;

describe("adopt CLI", () => {
  it("validates reviewed source and target authority without writing", async () => {
    const readFile = vi.fn(async () => JSON.stringify(authority));
    const result = await createAdoptCliHandler({ readFile }).run(
      [
        "adopt",
        "preflight",
        "--source",
        "source",
        "--target",
        "target",
        "--authority",
        "authority.json",
        "--json",
      ],
      "/repo",
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mutationPosture: "read-only",
    });
    expect(readFile).toHaveBeenCalledOnce();
  });

  it("previews a work package and truthfully reports that writes are absent", async () => {
    const workPackage = {
      ...fixture,
      roots: {
        ...(fixture.roots as Record<string, unknown>),
        source: "/repo/source",
        target: "/repo/target",
        sourceWorktree: "/repo/source",
        targetWorktree: "/repo/target",
      },
    };
    const result = await createAdoptCliHandler({
      readFile: async () => JSON.stringify(workPackage),
    }).run(
      [
        "adopt",
        "work-package",
        "--source",
        "source",
        "--target",
        "target",
        "--input",
        "work-package.json",
        "--out",
        "adoption/plan.json",
      ],
      "/repo",
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      requestedOutput: "adoption/plan.json",
      writeSupported: false,
    });
  });

  it.each([
    ["write", ["adopt", "preflight", "--write"]],
    ["cutover", ["adopt", "cutover"]],
    [
      "root drift",
      [
        "adopt",
        "preflight",
        "--source",
        "other",
        "--target",
        "target",
        "--authority",
        "authority.json",
      ],
    ],
  ])("rejects %s", async (_name, argv) => {
    const result = await createAdoptCliHandler({
      readFile: async () => JSON.stringify(authority),
    }).run(argv, "/repo");
    expect(result.exitCode).not.toBe(0);
  });

  it("rejects packet symlinks without changing the filesystem", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-adopt-root-"));
    const outside = await mkdtemp(join(tmpdir(), "maestro-adopt-outside-"));
    try {
      const externalPacket = join(outside, "authority.json");
      await writeFile(externalPacket, JSON.stringify(authority), "utf8");
      await symlink(externalPacket, join(root, "authority.json"));
      const snapshot = async () =>
        [...(await readdir(root, { recursive: true }))].sort();
      const before = await snapshot();
      const result = await createAdoptCliHandler({
        readFile: (repositoryRoot, path) =>
          readBoundedAdoptionPacket(repositoryRoot, path, 256 * 1024),
      }).run(
        [
          "adopt",
          "preflight",
          "--source",
          "source",
          "--target",
          "target",
          "--authority",
          "authority.json",
        ],
        root,
      );
      expect(result.exitCode).toBe(2);
      expect(await snapshot()).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
