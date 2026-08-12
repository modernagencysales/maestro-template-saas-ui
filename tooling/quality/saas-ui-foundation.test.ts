import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  checkSaasUiFoundation,
  readSaasUiAcceptance,
  readSaasUiDeviations,
  readSaasUiManifest,
  readSaasUiRegistryFiles,
  hasExecutableEvidenceDeclaration,
} from "./saas-ui-foundation.js";

const root = process.cwd();

describe("Saas UI foundation authorities", () => {
  it("pins every paid source and maps every accepted composition", () => {
    const manifest = readSaasUiManifest(root);

    expect(manifest.pins).toEqual({
      template: "acf0bc4be38dea842f321831387fc77cf7242439",
      starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
      pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    });
    expect(new Set(manifest.compositions.map(({ id }) => id))).toEqual(
      new Set([
        "app-shell",
        "dashboard-report",
        "data-grid",
        "filterable-collection",
        "list-detail",
        "split-inbox",
        "record-aside",
        "settings",
        "form",
        "onboarding",
        "kanban",
        "auth",
        "billing",
        "search-command",
        "states",
      ]),
    );
    expect(readSaasUiDeviations(root).map(({ source }) => source)).toEqual([
      "@saas-ui-pro/react@1.0.0-next.4:components/resize/use-resize.ts:useEventListener(document, ...)",
      "@saas-ui-pro/react@1.0.0-next.4:components/resize/resize-handle.tsx:ResizeHandle",
      "tsconfig.base.json:compilerOptions.exactOptionalPropertyTypes",
      "tsconfig.base.json:compilerOptions.noUncheckedIndexedAccess",
      "@chakra-ui/react@3.30.0:components/stat:StatRoot",
      "apps/web/src/features/common/providers/app-provider.tsx:QueryClientProvider/AuthProvider",
      "@saas-ui-pro/react@1.0.0-next.4:components/resize/Resizer",
      "apps/web/src/routes/__root.tsx:AppProvider",
      "apps/web/src/lib/trpc/react.tsx:fake procedure facade",
      "@saas-ui-pro/react@1.0.0-next.4:Aside.Root",
      "@saas-ui-pro/react@1.0.0-next.4:DataGridColumnResizer",
      "@saas-ui-pro/react@1.0.0-next.4:DataGridSort and DataGridHeaderCell",
      "apps/web/src/features/auth/login-page.tsx; apps/web/src/features/settings/billing/manage-billing-button.tsx",
      "@saas-ui/react:Steps.List dots recipe",
      "@saas-ui/react:BackButtonPrimitive",
      "@chakra-ui/react semantic token fg.error",
      "@saas-ui-pro/react@1.0.0-next.4:components/split-page/SplitPage",
    ]);
    expect(readSaasUiRegistryFiles(root).files.length).toBeGreaterThan(0);
    expect(checkSaasUiFoundation(root)).toEqual([]);
  });

  it("requires every composition to have acceptance evidence", () => {
    const manifest = readSaasUiManifest(root);
    const acceptance = readSaasUiAcceptance(root);

    expect(acceptance.entries).toHaveLength(manifest.compositions.length);
    expect(new Set(acceptance.entries.map(({ id }) => id))).toEqual(
      new Set(manifest.compositions.map(({ id }) => id)),
    );
    expect(
      acceptance.entries.every(
        ({ route, behaviorCheck, evidence }) =>
          route.startsWith("/") &&
          behaviorCheck.length > 0 &&
          evidence.length > 0,
      ),
    ).toBe(true);
  });

  it.each(["destination", "change", "reason", "evidence"] as const)(
    "rejects a tampered deviation %s",
    (field) => {
      const temporaryRoot = mkdtempSync(join(tmpdir(), "saas-ui-deviation-"));
      try {
        mkdirSync(join(temporaryRoot, "docs/template"), { recursive: true });
        const authority = JSON.parse(
          readFileSync(
            join(root, "docs/template/saas-ui-deviations.json"),
            "utf8",
          ),
        ) as {
          deviations: Array<Record<string, unknown>>;
          authorityDigest: string;
        };
        const first = authority.deviations[0];
        if (!first) throw new Error("missing deviation fixture");
        first[field] = `${String(first[field])} tampered`;
        writeFileSync(
          join(temporaryRoot, "docs/template/saas-ui-deviations.json"),
          JSON.stringify(authority),
        );
        expect(() => readSaasUiDeviations(temporaryRoot)).toThrow(
          /authority|digest/,
        );
      } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
      }
    },
  );

  it("rejects a preference reason even when the JSON digest is recomputed", () => {
    const authority = JSON.parse(
      readFileSync(join(root, "docs/template/saas-ui-deviations.json"), "utf8"),
    ) as {
      deviations: Array<Record<string, unknown>>;
      authorityDigest: string;
    };
    const first = authority.deviations[0];
    if (!first) throw new Error("missing deviation fixture");
    first.reason = "aesthetic preference";
    authority.authorityDigest = createHash("sha256")
      .update(JSON.stringify(authority.deviations))
      .digest("hex");
    const temporaryRoot = mkdtempSync(
      join(tmpdir(), "saas-ui-deviation-preference-"),
    );
    try {
      mkdirSync(join(temporaryRoot, "docs/template"), { recursive: true });
      writeFileSync(
        join(temporaryRoot, "docs/template/saas-ui-deviations.json"),
        JSON.stringify(authority),
      );
      expect(() => readSaasUiDeviations(temporaryRoot)).toThrow(
        /authority|digest/,
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ['// it("proof")', false],
    ['const proof = "it(\\"proof\\")";', false],
    ['it.skip("proof", () => {})', false],
    ['it.todo("proof")', false],
    ['it("proof")', false],
    ['it("proof", undefined)', false],
    ['if (false) it("proof", () => {})', false],
    ['false && it("proof", () => {})', false],
    ['function helper() { it("proof", () => {}) }', false],
    ['it("proof", () => {})', true],
    ['test.each([[1]])("proof", () => {})', true],
  ])(
    "requires an enabled executable evidence declaration",
    (source, expected) => {
      expect(hasExecutableEvidenceDeclaration(source, "proof")).toBe(expected);
    },
  );
});
