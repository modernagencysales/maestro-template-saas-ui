import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.TEMPLATE_HOSTED_URL ?? "https://maestro-template.pages.dev";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./artifacts/saas-ui-golden/playwright",
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
