import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isDirectPathWithinRoot } from "./temporaryPath.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("direct temporary paths", () => {
  it("allows a canonical root alias without allowing nested symlinks", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "maestro-temp-path-"));
    temporaryRoots.push(fixture);
    const canonicalRoot = join(fixture, "canonical");
    const aliasRoot = join(fixture, "alias");
    await mkdir(join(canonicalRoot, "direct"), { recursive: true });
    await symlink(canonicalRoot, aliasRoot, "dir");

    expect(
      await isDirectPathWithinRoot(join(aliasRoot, "direct"), aliasRoot),
    ).toBe(true);

    await mkdir(join(canonicalRoot, "outside"));
    await symlink(
      join(canonicalRoot, "outside"),
      join(canonicalRoot, "nested"),
    );
    expect(
      await isDirectPathWithinRoot(join(aliasRoot, "nested"), aliasRoot),
    ).toBe(false);

    const sibling = join(fixture, "sibling");
    await mkdir(sibling);
    expect(await isDirectPathWithinRoot(sibling, aliasRoot)).toBe(false);
  });
});
