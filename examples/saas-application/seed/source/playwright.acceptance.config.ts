import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/acceptance",
  testMatch: "**/*.spec.ts",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  projects: [
    {
      name: "acceptance-chromium",
      use: { browserName: "chromium" },
    },
  ],
});
