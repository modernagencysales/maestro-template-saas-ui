import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "features/public-funnel");
const read = (path: string): string =>
  readFileSync(resolve(sourceRoot, path), "utf8");

describe("public funnel control authority", () => {
  it("uses installed Saas UI controls instead of raw shipped controls", () => {
    const controls = [
      "report/report-library-view.tsx",
      "report/report-ownership-card.tsx",
      "report/report-view.tsx",
      "report/report-revision-card.tsx",
      "intake/intake-view.tsx",
      "build-pack/build-pack-route.tsx",
      "build-pack/build-pack-view.tsx",
      "checkout/fake-hosted-checkout.tsx",
      "checkout/checkout-view.tsx",
    ].map(read);

    for (const source of controls) {
      expect(source).toContain('from "@saas-ui/react"');
      expect(source).not.toMatch(/<(button|input|textarea)\b/u);
    }
  });
});
