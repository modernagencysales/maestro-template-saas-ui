import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Receipt = Readonly<{
  files: readonly Readonly<{ destination: string; adapted?: boolean }>[];
}>;

const readReceipt = (path: string): Receipt =>
  JSON.parse(readFileSync(path, "utf8")) as Receipt;

describe("type coverage receipt boundary", () => {
  it("measures adaptations and authored code while ignoring exact paid source", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const files = [
      ...readReceipt(resolve(root, "docs/template/saas-ui-starter-files.json"))
        .files,
      ...readReceipt(resolve(root, "docs/template/saas-ui-registry-files.json"))
        .files,
    ];
    const adapted = new Set(
      files
        .filter(({ adapted }) => adapted === true)
        .map(({ destination }) => destination),
    );
    const expected = [
      ...new Set(
        files.flatMap(({ adapted: isAdapted, destination }) =>
          isAdapted !== true &&
          /[.]tsx?$/u.test(destination) &&
          !adapted.has(destination)
            ? [destination]
            : [],
        ),
      ),
    ].sort();
    const runner = resolve(root, "tooling/quality/run-type-coverage.mts");

    expect(existsSync(runner)).toBe(true);
    const module: unknown = await import(pathToFileURL(runner).href);
    expect(module).toBeTypeOf("object");
    const ignorePaths = (
      module as Readonly<{
        typeCoverageIgnorePaths(root: string): readonly string[];
      }>
    ).typeCoverageIgnorePaths(root);

    expect(expected).toHaveLength(295);
    expect(ignorePaths).toEqual(expected);
    for (const destination of adapted) {
      if (/[.]tsx?$/u.test(destination))
        expect(ignorePaths).not.toContain(destination);
    }
    expect(ignorePaths).not.toContain("apps/web/src/lib/auth/workos-auth.ts");
    expect(ignorePaths).not.toContain(
      "apps/web/src/components/user-avatar.tsx",
    );

    const packageJson = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as Readonly<{ scripts?: Readonly<Record<string, string>> }>;
    expect(packageJson.scripts?.["check:types-coverage"]).toBe(
      "tsx tooling/quality/run-type-coverage.mts",
    );
  });
});
