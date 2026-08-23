import { describe, expect, it } from "vitest";

import {
  assertFrontendDependencyContract,
  collectResolvedVersions,
  findGeneratedPresetTypeImports,
  findLegacyFrontendApiImports,
  findUnmaterializedShellImports,
  hasMenuButtonValueOmission,
  missingButtonRecipeVariants,
  missingStarterRecipeVariants,
  type DependencyTree,
} from "./check-frontend-dependency-contract.mts";

const tree = (
  name: string,
  version: string,
  dependencies: Record<string, DependencyTree> = {},
): DependencyTree => ({ name, version, dependencies });

describe("frontend dependency contract", () => {
  it("rejects removed Saas UI and Chakra v2 exports in transplanted sources", () => {
    expect(
      findLegacyFrontendApiImports({
        "hotkeys.ts": `import { HotkeysConfig } from "@saas-ui/react";`,
        "loading.tsx": `import { LoadingOverlay, LoadingSpinner } from "@saas-ui/react";`,
        "tag.tsx": `import { Tag, TagProps } from "@chakra-ui/react";`,
      }),
    ).toEqual([
      "hotkeys.ts imports removed HotkeysConfig from @saas-ui/react",
      "loading.tsx imports removed LoadingSpinner from @saas-ui/react",
      "tag.tsx imports removed TagProps from @chakra-ui/react",
    ]);
  });

  it("requires Chakra's generated Button type to include the pinned theme variants", () => {
    expect(
      missingButtonRecipeVariants(
        `export interface ButtonVariant { variant?: "solid" | "surface" | undefined }`,
      ),
    ).toEqual(["glass", "primary", "secondary", "tertiary"]);
    expect(
      missingButtonRecipeVariants(
        `export interface ButtonVariant { variant?: "solid" | "glass" | "primary" | "secondary" | "tertiary" | undefined }`,
      ),
    ).toEqual([]);
  });

  it("requires generated recipe types to match Starter runtime variants", () => {
    expect(
      missingStarterRecipeVariants(`
        export interface BadgeVariant { variant?: "subtle" }
        export interface MenuVariant { variant?: "subtle" }
        export interface TabsVariant { size?: "sm"; variant?: "line" }
      `),
    ).toEqual([
      "Badge.variant:ghost",
      "Menu.variant:compact",
      "Menu.variant:default",
      "Tabs.size:xs",
      "Tabs.variant:pills",
    ]);
  });

  it("requires the Saas UI menu trigger type compatibility patch", () => {
    expect(
      hasMenuButtonValueOmission(
        `interface MenuButtonProps extends ButtonProps, ChakraMenu.TriggerProps {}`,
      ),
    ).toBe(false);
    expect(
      hasMenuButtonValueOmission(
        `interface MenuButtonProps extends Omit<ButtonProps, 'value'>, ChakraMenu.TriggerProps {}`,
      ),
    ).toBe(true);
  });

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

  it("requires shell-level variants to use the materialized registry", () => {
    expect(
      findUnmaterializedShellImports({
        "apps/web/src/components/default-loader.tsx": `import { LoadingOverlay } from "@saas-ui/react";`,
        "apps/web/src/features/common/layouts/app-layout.tsx": `import { Sidebar } from "@saas-ui/react";`,
        "apps/web/src/features/common/components/app-sidebar.tsx": `import { Sidebar, useSidebar } from "@saas-ui/react";`,
        "apps/web/src/features/reports/reports-page.tsx": `import { Sidebar, useSidebar } from "@saas-ui/react";`,
        "apps/web/src/features/settings/common/settings-sidebar.tsx": `import { Sidebar } from "@saas-ui/react";`,
        "valid.tsx": `import { Sidebar } from "#components/ui/sidebar";`,
      }),
    ).toEqual([
      "apps/web/src/components/default-loader.tsx must use the materialized LoadingOverlay registry primitive",
      "apps/web/src/features/common/layouts/app-layout.tsx must use the materialized Sidebar registry primitive",
      "apps/web/src/features/common/components/app-sidebar.tsx must use the materialized Sidebar registry primitive",
      "apps/web/src/features/common/components/app-sidebar.tsx must use the materialized useSidebar registry primitive",
      "apps/web/src/features/reports/reports-page.tsx must use the materialized Sidebar registry primitive",
      "apps/web/src/features/reports/reports-page.tsx must use the materialized useSidebar registry primitive",
      "apps/web/src/features/settings/common/settings-sidebar.tsx must use the materialized Sidebar registry primitive",
    ]);
  });

  it("collects every resolved version in the recursive dependency graph", () => {
    const graph = [
      tree("web", "1.0.0", {
        "@internationalized/date": tree("@internationalized/date", "3.10.0"),
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
        "@internationalized/date": tree("@internationalized/date", "3.10.0"),
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
        "@internationalized/date": tree("@internationalized/date", "3.10.0"),
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
