import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["{src,evals}/**/*.test.{ts,tsx,mts,mjs}"],
    exclude: ["**/node_modules/**", "**/dist/**", "evals/runs/**"],
  },
});
