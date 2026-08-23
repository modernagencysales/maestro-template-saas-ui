import { describe, expect, it } from "vitest";

import {
  assertFrontendDependencyContract,
  collectResolvedVersions,
  findGeneratedPresetTypeImports,
  type DependencyTree,
} from "./check-frontend-dependency-contract.mts";

const tree = (
  name: string,
  version: string,
  dependencies: Record<string, DependencyTree> = {},
): DependencyTree => ({ name, version, dependencies });

describe("frontend dependency contract", () => {
  it("rejects registry wrappers that import unpublished generated recipe types", () => {
    expect(
      findGeneratedPresetTypeImports({
        "valid.tsx": `import { appShellSlotRecipe } from "@saas-ui/chakra-preset/slot-recipes/app-shell";`,
        "invalid.tsx": `import { type AppShellVariantProps, appShellSlotRecipe } from "@saas-ui/chakra-preset/slot-recipes/app-shell";`,
        "also-invalid.tsx": `import type { PageVariantProps } from "@saas-ui/chakra-preset/slot-recipes/page";`,
      }),
    ).toEqual([
      "also-invalid.tsx imports an unpublished generated VariantProps type from @saas-ui/chakra-preset",
      "invalid.tsx imports an unpublished generated VariantProps type from @saas-ui/chakra-preset",
    ]);
  });

  it("collects every resolved version in the recursive dependency graph", () => {
    const graph = [
      tree("web", "1.0.0", {
        "@tiptap/core": tree("@tiptap/core", "3.30.1"),
        editor: tree("editor", "1.0.0", {
          "@tiptap/core": tree("@tiptap/core", "3.30.0"),
        }),
      }),
    ];

    expect([
      ...(collectResolvedVersions(graph).get("@tiptap/core") ?? []),
    ]).toEqual(["3.30.1", "3.30.0"]);
  });

  it("accepts the one tested editor and drag-and-drop type world", () => {
    const graph = [
      tree("web", "1.0.0", {
        "@tiptap/core": tree("@tiptap/core", "3.30.1"),
        "@tiptap/pm": tree("@tiptap/pm", "3.30.1"),
        "@dnd-kit/sortable": tree("@dnd-kit/sortable", "8.0.0"),
      }),
    ];

    expect(assertFrontendDependencyContract(graph)).toEqual([]);
  });

  it("rejects duplicate or drifted type-bearing package versions", () => {
    const graph = [
      tree("web", "1.0.0", {
        "@tiptap/core": tree("@tiptap/core", "3.30.0"),
        editor: tree("editor", "1.0.0", {
          "@tiptap/core": tree("@tiptap/core", "3.30.1"),
          "@tiptap/pm": tree("@tiptap/pm", "3.30.1"),
        }),
        "@dnd-kit/sortable": tree("@dnd-kit/sortable", "10.0.0"),
      }),
    ];

    expect(assertFrontendDependencyContract(graph)).toEqual([
      "@dnd-kit/sortable must resolve only to 8.0.0; found 10.0.0",
      "@tiptap/core must resolve only to 3.30.1; found 3.30.0, 3.30.1",
    ]);
  });
});
