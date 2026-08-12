import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.TEMPLATE_HOSTED_URL ?? "http://127.0.0.1:4173";

// Until customer projection is available, both loopback authorities use the
// current factory app and the same neutral fixtures. The paired harness keeps
// the integration input finite and makes the generated-target substitution
// explicit instead of silently using a hosted URL.
process.env.UPSTREAM_REFERENCE_URL ??= "http://127.0.0.1:4173";
process.env.GOLDEN_GENERATED_URL ??= "http://127.0.0.1:4174";

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
  webServer: [
    {
      command: "pnpm --dir apps/web preview --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --dir apps/web preview --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
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
