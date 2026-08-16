import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Directories measured by the coverage ratchet. Everything runs under this
// root config; generated files and vendored trees are excluded below.
export const coverageRatchetDirs = [
  "packages/template-core",
  "packages/integrations",
  "packages/search",
  "packages/storage",
  "packages/notifications",
  "packages/observability",
  "packages/convex",
  "tooling/quality",
  "tooling/workflow",
  "tooling/release",
  "tooling/generators",
  "apps/cli",
  "apps/web",
];

export default defineConfig({
  resolve: {
    alias: {
      "#config": fileURLToPath(
        new URL("./apps/web/src/config", import.meta.url),
      ),
      "#components": fileURLToPath(
        new URL("./apps/web/src/components", import.meta.url),
      ),
      "#features": fileURLToPath(
        new URL("./apps/web/src/features", import.meta.url),
      ),
      "#lib": fileURLToPath(new URL("./apps/web/src/lib", import.meta.url)),
      "#theme": fileURLToPath(new URL("./apps/web/src/theme", import.meta.url)),
      [/^#config\//u]: fileURLToPath(
        new URL("./apps/web/src/config/", import.meta.url),
      ),
      [/^#components\//u]: fileURLToPath(
        new URL("./apps/web/src/components/", import.meta.url),
      ),
      [/^#features\//u]: fileURLToPath(
        new URL("./apps/web/src/features/", import.meta.url),
      ),
      [/^#lib\//u]: fileURLToPath(
        new URL("./apps/web/src/lib/", import.meta.url),
      ),
      [/^#theme\//u]: fileURLToPath(
        new URL("./apps/web/src/theme/", import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    include: ["**/*.test.{ts,tsx,mts,mjs}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "repos/**",
      "tooling/agent-pack/evals/runs/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: coverageRatchetDirs.map((dir) => `${dir}/**/*.{ts,mts,tsx}`),
      exclude: [
        "**/*.test.{ts,tsx,mts}",
        "**/test/support/**",
        "**/dist/**",
        "**/_generated/**",
        "**/__fixtures__/**",
        "apps/web/src/routeTree.gen.ts",
        "repos/**",
        "vendor/**",
      ],
      // Floors live in coverage-baseline.json; check:coverage-ratchet compares
      // the json-summary against it and refuses to let coverage fall.
    },
  },
});
