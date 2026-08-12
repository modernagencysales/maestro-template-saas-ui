import { test } from "./fixtures/saas-ui-golden-test";
import {
  acceptanceEntries,
  captureReferenceAndGenerated,
} from "./fixtures/saas-ui-golden";

test.describe("paired Saas UI golden visual evidence", () => {
  for (const colorMode of ["light", "dark"] as const) {
    for (const entry of acceptanceEntries) {
      test(`${entry.id} ready-read ${colorMode} captures both authorities`, async ({
        page,
      }) => {
        await captureReferenceAndGenerated({
          page,
          route: entry.route,
          fixture: "ready-read",
          colorMode,
          composition: entry.id,
        });
      });
    }
  }

  for (const fixture of [
    "loading",
    "empty",
    "ready-edit",
    "mutation-success",
    "mutation-failure",
  ] as const) {
    for (const colorMode of ["light", "dark"] as const) {
      test(`states ${fixture} ${colorMode} captures both authorities`, async ({
        page,
      }) => {
        await captureReferenceAndGenerated({
          page,
          route: "/states",
          fixture,
          colorMode,
          composition: "states",
        });
      });
    }
  }
});
