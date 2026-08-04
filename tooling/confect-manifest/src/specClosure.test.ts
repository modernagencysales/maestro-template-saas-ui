import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverReviewedContractSpecs,
  generatedRefModuleForSpec,
  missingGeneratedRefs,
} from "./specClosure";

const fixture = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "confect-spec-closure-"));
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
};

describe("reviewed Confect spec closure", () => {
  it("discovers only manifest/schema specs in repository-relative order", () => {
    const root = fixture({
      "packages/convex/confect/z.spec.ts":
        "export const schemaRegistry = {}; export const manifest = [];",
      "packages/convex/confect/a.spec.ts":
        "export const manifest = []; export const schemaRegistry = {};",
      "packages/convex/confect/raw.spec.ts": "export default {};",
      "packages/convex/confect/a.test.ts":
        "export const manifest = []; export const schemaRegistry = {};",
      "repos/confect/example.spec.ts":
        "export const manifest = []; export const schemaRegistry = {};",
    });

    expect(discoverReviewedContractSpecs(root)).toEqual([
      "packages/convex/confect/a.spec.ts",
      "packages/convex/confect/z.spec.ts",
    ]);
  });

  it("derives generated modules and fails closed on missing named refs", () => {
    const root = fixture({
      "packages/convex/convex/brain/pages.ts":
        "export const list = registeredFunctions.list; // export const createMarkdown = fake",
    });
    const specPath = "packages/convex/confect/brain/pages.spec.ts";

    expect(generatedRefModuleForSpec(specPath)).toBe(
      "packages/convex/convex/brain/pages.ts",
    );
    expect(
      missingGeneratedRefs(root, [
        { specPath, operationId: "brain.pages.list", name: "list" },
        {
          specPath,
          operationId: "brain.pages.createMarkdown",
          name: "createMarkdown",
        },
      ]),
    ).toEqual(["brain.pages.createMarkdown"]);
  });
});
