import js from "@eslint/js";
import templatePlugin from "./tooling/eslint-plugin-template/index.mjs";
import tseslint from "typescript-eslint";

const shiftLeft =
  globalThis.process.env.ESLINT_SHIFT_LEFT === "1" ? "error" : "off";

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "node_modules/**",
      "repos/**",
      "packages/convex/**/_generated/**",
      "apps/web/src/routeTree.gen.ts",
      ".pnpm-store/**",
      ".stryker-tmp/**",
      ".wrangler/**",
      "tooling/agent-pack/evals/runs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      complexity: [shiftLeft, 10],
      "max-depth": [shiftLeft, 4],
      "max-params": [shiftLeft, 5],
    },
  },
  {
    // Confect groups related TaggedErrors in value+type namespaces by
    // convention; ES module syntax cannot express that merge.
    files: ["packages/convex/confect/**/*.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    // Existing review providers predate the changed-file complexity ratchet.
    // Their new bounded coordinator is enforced independently.
    files: [
      "tooling/quality/taste-review.mts",
      "tooling/quality/contract-review.mts",
      "tooling/release/src/index.ts",
    ],
    rules: {
      complexity: "off",
      "max-depth": "off",
      "max-params": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
      },
    },
  },
  {
    files: ["packages/convex/confect/**/*.ts"],
    plugins: { template: templatePlugin },
    rules: {
      "template/typed-convex-errors": "error",
      "template/no-throw-in-effect-handler": "error",
      "template/no-throw-tagged-error": "error",
      "template/require-minrole-on-write": "error",
      "template/workflow-steps-are-capabilities": "error",
      "template/workflow-handler-determinism": "error",
      "template/workflow-policy-snapshot": "error",
      "template/no-cross-domain-value-import": "error",
      "template/no-raw-scheduler": "error",
      "template/no-raw-workflow-primitives": "error",
    },
  },
  {
    files: [
      "packages/convex/convex/workflowRunners/**/*.ts",
      "apps/**/*.{ts,tsx}",
    ],
    plugins: { template: templatePlugin },
    rules: {
      "template/no-raw-workflow-primitives": "error",
      "template/workflow-handler-determinism": "error",
      "template/workflow-steps-are-capabilities": "error",
      "template/workflow-policy-snapshot": "error",
    },
  },
  {
    files: ["apps/web/src/routes/**/*.{ts,tsx}"],
    plugins: { template: templatePlugin },
    rules: {
      "template/frontend-route-thin": "error",
      "template/frontend-route-server-boundary": "error",
    },
  },
  {
    files: [
      "tests/acceptance/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
      "examples/*/seed/source/tests/acceptance/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
    ],
    plugins: { template: templatePlugin },
    rules: {
      "template/acceptance-boundary": "error",
    },
  },
];
