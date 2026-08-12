import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildSaasApplicationTargetPlan } from "./saasApplication";

describe("SaaS UI generated target artifact boundary", () => {
  it.skipIf(
    !existsSync(
      fileURLToPath(
        new URL(
          "../../../../releases/v0.2.0-alpha.1/blueprints/saas-application/base/packages/ui/src/visualize/visualize.test.tsx.txt",
          import.meta.url,
        ),
      ),
    ),
  )(
    "keeps the mandatory frontend authority and private package boundary in the current target plan",
    () => {
      const plan = buildSaasApplicationTargetPlan({
        name: "Artifact Boundary",
      });
      const paths = new Set(plan.entries.map(({ path }) => path));
      const packageJson = JSON.parse(
        plan.entries.find(({ path }) => path === "package.json")?.content ??
          "{}",
      ) as { readonly private?: boolean };
      const webPackageJson = JSON.parse(
        plan.entries.find(({ path }) => path === "apps/web/package.json")
          ?.content ?? "{}",
      ) as { readonly private?: boolean };

      expect([...paths].some((path) => path.startsWith("apps/web/src/"))).toBe(
        true,
      );
      expect(packageJson.private).toBe(true);
      expect(webPackageJson.private).toBe(true);
      expect(
        [...paths].some((path) => path.startsWith("apps/web/dist/client/")),
      ).toBe(false);
    },
  );
});
