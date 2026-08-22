import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import config from "../../vitest.config";

type Receipt = Readonly<{
  files: readonly Readonly<{ destination: string; adapted?: boolean }>[];
}>;

const receipt = (path: string): Receipt =>
  JSON.parse(
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
  ) as Receipt;

describe("coverage receipt boundary", () => {
  it("measures application adaptations but not immutable upstream source", () => {
    const excludes = config.test?.coverage?.exclude ?? [];
    const files = receipt("docs/template/saas-ui-registry-files.json").files;

    for (const { adapted, destination } of files) {
      if (!/[.]tsx?$/u.test(destination)) continue;
      if (adapted === true) {
        expect(excludes).not.toContain(destination);
      } else {
        expect(excludes).toContain(destination);
      }
    }
    expect(excludes).toContain("apps/web/src/routeTree.gen.ts");
    expect(excludes).not.toContain("apps/web/src/lib/auth/workos-auth.ts");
  });
});
