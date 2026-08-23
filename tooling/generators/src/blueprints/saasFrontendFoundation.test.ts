import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  it("reads the route-tree authority from the requested source root", () => {
    const root = mkdtempSync(join(tmpdir(), "saas-ui-source-root-"));
    const routeTreePath = join(root, "apps/web/src/routeTree.gen.ts");
    const routeTree = "// source-root route tree\n";

    try {
      execFileSync("git", [
        "clone",
        "--quiet",
        "--shared",
        fileURLToPath(repoRoot),
        root,
      ]);
      writeFileSync(routeTreePath, routeTree);
      const entry = buildSaasApplicationTargetPlan({
        name: "source-root",
        sourceRoot: root,
      }).entries.find(({ path }) => path === "apps/web/src/routeTree.gen.ts");

      expect(entry?.content).toBe(routeTree);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("fails closed when the requested source root is incomplete", () => {
    const root = mkdtempSync(join(tmpdir(), "saas-ui-source-root-"));

    try {
      expect(() =>
        buildSaasApplicationTargetPlan({
          name: "source-root",
          sourceRoot: root,
        }),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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
      "apps/web/src/routes/_app/$workspace/_dashboard/index.tsx",
      "apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
      "packages/ui/package.json",
      "apps/web/src/theme/preset.ts",
      "apps/web/src/features/common/layouts/app-layout.tsx",
      "eslint.config.mjs",
      "docs/template/saas-ui-upstream.json",
      "docs/template/saas-ui-acceptance.json",
      "docs/template/saas-ui-deviations.json",
      "docs/template/saas-ui-starter-files.json",
      "tooling/quality/check-saas-ui-artifact-safety.mts",
      "tooling/quality/check-saas-ui-typecheck.mts",
      "tooling/quality/fixtures/saas-ui-typecheck-baseline.json",
      "tooling/quality/src/direct-run.mts",
      "tooling/eslint-plugin-template/saas-ui-registry-receipt.mjs",
      ...manifest.licenses.map(({ destination }) => destination),
    ])
      expect(paths.has(path), path).toBe(true);
  });

  it("projects every local ESLint rule imported by the advertised lint command", () => {
    const paths = new Set(saasFrontendFoundationPaths());
    const plugin = readSource("tooling/eslint-plugin-template/index.mjs");
    const imports = [...plugin.matchAll(/from "\.\/(rules\/[^"]+)"/gu)].map(
      ([, path]) => `tooling/eslint-plugin-template/${path}`,
    );

    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) expect(paths.has(path), path).toBe(true);
  });

  it("projects only the literal Starter route authority", () => {
    const paths = saasFrontendFoundationPaths();
    const targetPaths = buildSaasApplicationTargetPlan({
      name: "route authority",
      patterns: ["records-example"],
    }).entries.map(({ path }) => path);

    expect(paths).toContain(
      "apps/web/src/routes/_app/$workspace/_dashboard/index.tsx",
    );
    expect(paths).not.toContain("apps/web/src/routes/dashboard.tsx");
    expect(paths.some((path) => path.includes("/routes/_workspace"))).toBe(
      false,
    );
    const forbidden = [
      "/features/golden/",
      "/features/public-funnel/",
      "business-shell",
      "apps/web/src/navigation/",
      "apps/web/src/providers/",
      "apps/web/src/workspace/",
      "apps/web/src/saas-ui/",
    ];
    for (const fragment of forbidden)
      expect(
        paths.some((path) => path.includes(fragment)),
        fragment,
      ).toBe(false);
    for (const path of targetPaths) {
      expect(path.includes("/routes/_workspace"), path).toBe(false);
      for (const fragment of forbidden)
        expect(path.includes(fragment), path).toBe(false);
    }
    const recordsRoute = buildSaasApplicationTargetPlan({
      name: "route authority",
      patterns: ["records-example"],
    }).entries.find(
      ({ path }) =>
        path === "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
    );
    expect(recordsRoute?.content).toContain(
      'createFileRoute("/_app/$workspace/_dashboard/records")',
    );
    expect(recordsRoute?.content).not.toContain("_workspace");
  });

  it("receipt-binds the literal Starter route authority", () => {
    const receipt = JSON.parse(
      readSource("docs/template/saas-ui-starter-files.json"),
    ) as { readonly files: readonly { readonly destination: string }[] };
    const destinations = new Set(
      receipt.files.map(({ destination }) => destination),
    );

    const foundation = new Set(saasFrontendFoundationPaths());
    for (const path of [...destinations].filter(
      (path) =>
        path === "apps/web/src/router.tsx" ||
        path === "apps/web/src/routeTree.gen.ts" ||
        path.startsWith("apps/web/src/routes/"),
    ))
      expect(foundation.has(path), path).toBe(true);
  });

  it("receipt-binds generated adaptations of Starter route authority", () => {
    const plan = buildSaasApplicationTargetPlan({
      name: "receipt authority",
      patterns: ["records-example"],
    });
    const entries = new Map(
      plan.entries.map(({ path, content }) => [path, content]),
    );
    const routeTree = entries.get("apps/web/src/routeTree.gen.ts") ?? "";
    const receipt = JSON.parse(
      entries.get("docs/template/saas-ui-starter-files.json") ?? "{}",
    ) as {
      readonly files?: readonly {
        readonly destination?: string;
        readonly sha256?: string;
      }[];
    };
    const routeTreeReceipt = receipt.files?.find(
      ({ destination }) => destination === "apps/web/src/routeTree.gen.ts",
    );

    expect(routeTree).toContain("AppWorkspaceDashboardRecordsRouteImport");
    expect(routeTreeReceipt?.sha256).toBe(
      createHash("sha256").update(routeTree).digest("hex"),
    );
  });

  it("ships the files used by generated Saas UI check scripts", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "tooling closure" });
    const paths = new Set(plan.entries.map(({ path }) => path));
    const packageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as { readonly scripts?: Readonly<Record<string, string>> };

    for (const name of [
      "check:saas-ui-foundation",
      "check:saas-ui-artifact-safety",
    ]) {
      const command = packageJson.scripts?.[name] ?? "";
      for (const part of command.split(" && ")) {
        const executable = /^tsx (\S+)(?: .*)?$/u.exec(part)?.[1];
        expect(executable, `${name}: ${part}`).toBeDefined();
        expect(paths.has(executable ?? ""), `${name}: ${executable}`).toBe(
          true,
        );
      }
    }
  });
});
