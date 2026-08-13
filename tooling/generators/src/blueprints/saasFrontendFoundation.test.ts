import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSaasApplicationTargetPlan } from "./saasApplication";
import {
  saasFrontendFoundationFiles,
  saasFrontendFoundationPaths,
} from "./saasFrontendFoundation";

const repoRoot = new URL("../../../../", import.meta.url);
const readSource = (path: string): string =>
  readFileSync(new URL(path, repoRoot), "utf8");

describe("mandatory SaaS UI frontend foundation", () => {
  it("projects the frontend foundation for every current pattern selection", () => {
    for (const patterns of [
      [],
      ["records-example"],
      ["workflow-automation"],
    ] as const) {
      const paths = new Set(
        buildSaasApplicationTargetPlan({
          name: "golden",
          patterns,
        }).entries.map(({ path }) => path),
      );

      for (const required of saasFrontendFoundationPaths())
        expect(
          paths.has(required),
          `${patterns.join(",") || "neutral"}: ${required}`,
        ).toBe(true);
    }
  });

  it("is a deterministic manifest and receipt-derived file closure", () => {
    const first = saasFrontendFoundationFiles(readSource);
    const second = saasFrontendFoundationFiles(readSource);

    expect(first).toEqual(second);
    expect(first.map(({ path }) => path)).toEqual(
      [...saasFrontendFoundationPaths()].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
    expect(new Set(first.map(({ path }) => path)).size).toBe(first.length);
    expect(
      first.find(({ path }) => path === "apps/web/components.json"),
    ).toBeDefined();
    expect(
      first.find(
        ({ path }) => path === "docs/template/saas-ui-acceptance.json",
      ),
    ).toBeDefined();
  });

  it("includes the installed registry, starter chassis, and frontend authorities", () => {
    const paths = new Set(saasFrontendFoundationPaths());
    const manifest = JSON.parse(
      readSource("docs/template/saas-ui-upstream.json"),
    ) as {
      readonly compositions: readonly {
        readonly files: readonly { readonly destination: string }[];
      }[];
      readonly licenses: readonly { readonly destination: string }[];
    };
    const receipt = JSON.parse(
      readSource("docs/template/saas-ui-registry-files.json"),
    ) as { readonly files: readonly { readonly destination: string }[] };

    expect(paths.has("apps/web/components.json")).toBe(true);
    for (const { destination } of receipt.files)
      expect(paths.has(destination), destination).toBe(true);
    for (const destination of [
      "apps/web/src/theme/preset.ts",
      "apps/web/src/theme/semantic-tokens/colors.ts",
      "apps/web/src/features/common/providers/app-provider.tsx",
      "apps/web/src/features/common/layouts/app-layout.tsx",
      "apps/web/src/features/common/layouts/dashboard-layout.tsx",
      "apps/web/src/features/contacts/list/list-page.tsx",
    ])
      expect(paths.has(destination), destination).toBe(true);
    for (const { destination } of manifest.compositions.flatMap(
      ({ files }) => files,
    ))
      expect(paths.has(destination), destination).toBe(true);
    for (const path of [
      "apps/web/src/features/golden/fixtures.ts",
      "apps/web/src/theme/preset.ts",
      "apps/web/src/features/common/layouts/app-layout.tsx",
      "eslint.config.mjs",
      "docs/template/saas-ui-upstream.json",
      "docs/template/saas-ui-acceptance.json",
      "docs/template/saas-ui-deviations.json",
      "docs/template/saas-ui-starter-files.json",
      "tooling/quality/check-saas-ui-artifact-safety.mts",
      "tooling/quality/src/direct-run.mts",
      "tooling/eslint-plugin-template/saas-ui-registry-receipt.mjs",
      ...manifest.licenses.map(({ destination }) => destination),
    ])
      expect(paths.has(path), path).toBe(true);
  });
});
