import js from "@eslint/js";
import templatePlugin from "./tooling/eslint-plugin-template/index.mjs";
import {
  saasUiRegistryReceiptFiles,
  saasUiStarterReceiptFiles,
} from "./tooling/eslint-plugin-template/saas-ui-registry-receipt.mjs";
import tseslint from "typescript-eslint";

export const saasUiRegistryStandardRuleOverrides = Object.freeze({
  "@typescript-eslint/ban-ts-comment": "off",
  "@typescript-eslint/no-empty-object-type": "off",
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/no-unused-vars": "off",
});

export function saasUiRegistryReceiptConfig(receiptPath) {
  const files = saasUiRegistryReceiptFiles(receiptPath);
  return files.length === 0
    ? null
    : {
        files,
        rules: saasUiRegistryStandardRuleOverrides,
      };
}

export function saasUiStarterReceiptConfig(receiptPath) {
  const files = saasUiStarterReceiptFiles(receiptPath);
  return files.length === 0
    ? null
    : {
        files,
        rules: saasUiRegistryStandardRuleOverrides,
      };
}

const saasUiRegistryConfig = saasUiRegistryReceiptConfig();
const saasUiStarterConfig = saasUiStarterReceiptConfig();

const shiftLeft =
  globalThis.process.env.ESLINT_SHIFT_LEFT === "1" ? "error" : "off";

export default [
  {
    ignores: [
      "dist/**",
      "**/dist/**",
      "**/.output/**",
      "coverage/**",
      "node_modules/**",
      "repos/**",
      "packages/convex/**/_generated/**",
      "apps/web/src/routeTree.gen.ts",
      ".pnpm-store/**",
      ".stryker-tmp/**",
      ".wrangler/**",
      "tooling/agent-pack/evals/runs/**",
      "**/*.html",
      "**/*.json",
      "**/*.svg",
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
    files: ["packages/saas-api/types.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
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
    // Existing review providers and AP-010 App Map composition predate the
    // changed-file complexity ratchet; their boundaries are checked separately.
    files: [
      "tooling/quality/taste-review.mts",
      "tooling/quality/contract-review.mts",
      "tooling/release/src/index.ts",
      "tooling/app-map/src/composition.ts",
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
      "apps/**/src/**/*.{ts,tsx}",
      "packages/**/src/**/*.{ts,tsx}",
      "tooling/generators/**/*.{ts,tsx,txt}",
      "generated/**/*.{ts,tsx}",
    ],
    plugins: { template: templatePlugin },
    rules: {
      "template/saas-ui-shell-authority": "error",
      "template/prefer-saas-ui-primitives": "error",
      "template/saas-ui-semantic-colors": "error",
    },
  },
  ...(saasUiRegistryConfig ? [saasUiRegistryConfig] : []),
  ...(saasUiStarterConfig ? [saasUiStarterConfig] : []),
  {
    files: [
      "tests/acceptance/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
      "examples/*/seed/source/tests/acceptance/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
      "playwright.acceptance.config.ts",
      "examples/*/seed/source/playwright.acceptance.config.ts",
    ],
    plugins: { template: templatePlugin },
    linterOptions: { noInlineConfig: true },
    rules: {
      "template/acceptance-boundary": "error",
    },
  },
];
