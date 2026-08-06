import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkRecipes } from "./check-recipes.mts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("check:recipes", () => {
  it("passes the live recipe, owner, generator, gate, and semantic registries", () => {
    expect(checkRecipes(repoRoot)).toEqual([]);
  });

  it("fails closed on recipe bytes outside the generated index", () => {
    const fixture = makeFixture();
    const path = join(
      fixture,
      "docs/template/recipes/crud-business-entity.json",
    );
    writeFileSync(path, `${readFileSync(path, "utf8")}\n`);

    expect(checkRecipes(fixture)).toEqual([
      expect.stringContaining("checksum mismatch"),
    ]);
  });

  it("fails when a recipe owner disappears from the live catalog", () => {
    const fixture = makeFixture();
    const path = join(fixture, "docs/template/system-catalog.json");
    const catalog = JSON.parse(readFileSync(path, "utf8")) as {
      systems: { id: string }[];
    };
    catalog.systems = catalog.systems.filter(
      ({ id }) => id !== "data-lifecycle",
    );
    writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);

    expect(checkRecipes(fixture)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unknown canonical owner data-lifecycle"),
      ]),
    );
  });
});

function makeFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "maestro-recipes-"));
  temporaryRoots.push(fixture);
  cpSync(
    join(repoRoot, "docs/template/recipes"),
    join(fixture, "docs/template/recipes"),
    { recursive: true },
  );
  cpSync(
    join(repoRoot, "docs/template/system-catalog.json"),
    join(fixture, "docs/template/system-catalog.json"),
  );
  cpSync(join(repoRoot, "package.json"), join(fixture, "package.json"));
  cpSync(join(repoRoot, "apps"), join(fixture, "apps"), { recursive: true });
  mkdirSync(join(fixture, "tooling/generators"), { recursive: true });
  cpSync(
    join(repoRoot, "tooling/generators/package.json"),
    join(fixture, "tooling/generators/package.json"),
  );
  return fixture;
}
