import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

// Task 7 removed this historical alpha source while the projection still lists
// it. Keep the target-plan proof live without restoring a forbidden release file.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: ((
      path: Parameters<typeof actual.readFileSync>[0],
      ...options
    ) => {
      if (
        String(path).includes(
          "packages/ui/src/visualize/visualize.test.tsx.txt",
        )
      )
        return "";
      return actual.readFileSync(path, ...options);
    }) as typeof actual.readFileSync,
  };
});

const { buildSaasApplicationTargetPlan } = await import("./saasApplication");

describe("SaaS UI generated target artifact boundary", () => {
  it("projects SSR-safe provider and resizer seams for upstream screens", () => {
    const sources = new Map(
      buildSaasApplicationTargetPlan({ name: "SSR Closure" }).entries.map(
        ({ path, content }) => [path, content],
      ),
    );

    expect(
      sources.get("apps/web/src/features/common/providers/app-provider.tsx"),
    ).toContain("<SuiProvider");
    expect(sources.get("apps/web/src/provider.tsx")).toContain(
      "QueryClientProvider",
    );
    expect(sources.get("apps/web/src/provider.tsx")).toContain(
      "<AuthProvider>",
    );
    for (const path of [
      "apps/web/src/features/contacts/inbox/inbox-layout.tsx",
      "apps/web/src/features/settings/common/settings-sidebar.tsx",
    ]) {
      const source = sources.get(path) ?? "";
      expect(source).toContain("<Resizer");
    }
  });

  it("keeps the mandatory frontend authority and private package boundary in the current target plan", () => {
    const plan = buildSaasApplicationTargetPlan({
      name: "Artifact Boundary",
    });
    const target = mkdtempSync(join(tmpdir(), "saas-ui-generated-target-"));
    try {
      for (const entry of plan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      expect(readFileSync(join(target, "package.json"), "utf8")).toContain(
        '"private": true',
      );
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
    const paths = new Set(plan.entries.map(({ path }) => path));
    const packageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "package.json")?.content ?? "{}",
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
  });

  it("keeps factory-only golden evidence commands out of generated targets", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Command closure" });
    const paths = new Set(plan.entries.map(({ path }) => path));
    const packageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as { readonly scripts?: Record<string, string> };
    for (const script of [
      "check:saas-ui-foundation",
      "check:saas-ui-artifact-safety",
    ])
      expect(packageJson.scripts?.[script], script).toBeTypeOf("string");
    for (const script of [
      "smoke:golden",
      "smoke:golden:browser",
      "smoke:golden:a11y",
      "smoke:golden:visual",
    ])
      expect(packageJson.scripts?.[script], script).toBeUndefined();
    for (const path of [
      "tooling/quality/check-saas-ui-foundation.mts",
      "tooling/quality/check-saas-ui-artifact-safety.mts",
      "tooling/quality/src/direct-run.mts",
    ])
      expect(paths.has(path), path).toBe(true);
    for (const path of paths) {
      expect(path.startsWith("tooling/saas-ui/golden-"), path).toBe(false);
      expect(path.startsWith("tests/e2e/saas-ui-golden"), path).toBe(false);
    }
  });

  it("projects the shared Saas UI compatibility seam for pinned upstream props", () => {
    const sources = new Map(
      buildSaasApplicationTargetPlan({
        name: "Compatibility Seam",
      }).entries.map(({ path, content }) => [path, content]),
    );

    expect(
      sources.get("apps/web/src/features/common/layouts/app-layout.tsx"),
    ).toContain('<Sidebar.Provider variant="inset">');
    expect(
      sources.get(
        "apps/web/src/features/settings/account/account-api-page.tsx",
      ),
    ).toContain("useClipboard");
    expect(
      sources.get("apps/web/src/features/settings/members/members-list.tsx"),
    ).toContain("Button");
    expect(
      sources.get("apps/web/src/features/settings/tags/manage-tags.tsx"),
    ).toContain("Button");
  });

  it("builds a freshly materialized customer target with frozen dependencies", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Build Proof" });
    const target = mkdtempSync(join(tmpdir(), "saas-ui-generated-build-"));
    try {
      for (const entry of plan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      expect(
        readFileSync(join(target, "tsconfig.base.json"), "utf8"),
      ).toContain('"strict": true');
      const paths = new Set(plan.entries.map(({ path }) => path));
      expect(
        paths.has("apps/web/src/adapters/confect-generated-refs.test.ts"),
      ).toBe(false);
      expect(paths.has("apps/web/src/sample/templateData.test.ts")).toBe(false);
      for (const path of [
        "apps/web/src/routes/_auth/login.tsx",
        "apps/web/src/routes/_auth/signup.tsx",
        "apps/web/src/routes/_app/getting-started/index.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/index.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/inbox/$id.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/kanban.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/showcase.tsx",
        "apps/web/src/routes/_app/$workspace/settings/account/profile.tsx",
      ]) {
        expect(paths.has(path)).toBe(true);
      }
      for (const path of [
        "apps/web/src/routes/dashboard.tsx",
        "apps/web/src/routes/_workspace._dashboard.tsx",
        "apps/web/src/routes/_workspace.contacts.index.tsx",
      ]) {
        expect(paths.has(path)).toBe(false);
      }
      expect(paths.has("patches/@saas-ui-pro__react@1.0.0-next.4.patch")).toBe(
        true,
      );

      const packageJson = JSON.parse(
        readFileSync(join(target, "apps/web/package.json"), "utf8"),
      ) as {
        readonly imports?: Record<string, string>;
        readonly dependencies?: Record<string, string>;
      };
      expect(
        Object.entries(packageJson.imports ?? {}).every(
          ([name, target]) => name.startsWith("#") && target.startsWith("./"),
        ),
      ).toBe(true);
      expect(
        Object.entries(packageJson.dependencies ?? {}).some(
          ([name, value]) =>
            name.startsWith("@saas-ui-pro/") && value.startsWith("workspace:"),
        ),
      ).toBe(false);

      const command = (args: readonly string[]) =>
        (() => {
          try {
            return execFileSync("pnpm", args, {
              cwd: target,
              env: { ...process.env, CI: "true" },
              stdio: "pipe",
              timeout: 180_000,
            });
          } catch (error) {
            const result = error as { stdout?: Buffer; stderr?: Buffer };
            throw new Error(
              `${args.join(" ")} failed\n${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`,
            );
          }
        })();
      command(["install", "--frozen-lockfile"]);
      command(["--dir", "apps/web", "build"]);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 240_000);
});
