import { defineConfig } from "vitest/config";

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
