import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname);
const read = (path: string): string =>
  readFileSync(resolve(sourceRoot, path), "utf8");

describe("package UI authority contract", () => {
  it("keeps non-foundational document and platform patterns available", () => {
    const index = read("index.tsx");

    for (const path of [
      "./blocks/notion-document",
      "./coediting/coediting-shell",
      "./platform/command-palette",
      "./platform/notification-center",
      "./platform/onboarding",
      "./visualize",
    ]) {
      expect(index).toContain(path);
    }
  });

  it("does not retain competing foundational primitives or toast helpers", () => {
    const index = read("index.tsx");

    for (const path of ["primitives.tsx", "blocks/ux-essentials.tsx"]) {
      expect(existsSync(resolve(sourceRoot, path))).toBe(false);
    }
    expect(index).not.toContain("./blocks/ux-essentials");
  });
});
