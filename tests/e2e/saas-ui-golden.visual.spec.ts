import { test } from "@playwright/test";
import { captureReferenceAndGenerated } from "./fixtures/saas-ui-golden";

test.describe("paired Saas UI golden visual evidence", () => {
  for (const colorMode of ["light", "dark"] as const) {
    for (const viewport of ["shell", "reports"] as const) {
      test(`${viewport} ${colorMode} captures both authorities`, async ({
        page,
      }, testInfo) => {
        await captureReferenceAndGenerated({
          page,
          testInfo,
          route: viewport === "shell" ? "/dashboard" : "/reports",
          fixture: "ready-read",
          colorMode,
          composition: viewport,
        });
      });
    }
  }
});
