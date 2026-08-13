import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.TEMPLATE_HOSTED_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  reporter: "list",
  testDir: "./tests/e2e",
  outputDir: "./artifacts/playwright",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --dir apps/web dev --host 127.0.0.1 --port 4173",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
