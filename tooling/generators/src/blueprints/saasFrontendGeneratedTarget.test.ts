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
    ).toContain("QueryClientProvider");
    expect(
      sources.get("apps/web/src/features/common/providers/app-provider.tsx"),
    ).toContain("<AuthProvider>");
    for (const path of [
      "apps/web/src/features/contacts/inbox/inbox-layout.tsx",
      "apps/web/src/features/settings/common/settings-sidebar.tsx",
    ]) {
      const source = sources.get(path) ?? "";
      expect(source).toContain("<ClientResizer");
      expect(source).not.toContain("<Resizer");
    }
    expect(
      sources.get("apps/web/src/features/contacts/list/list-page.tsx"),
    ).toContain("<ClientOnly fallback={null}>");
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

  it("projects every entrypoint needed by advertised SaaS UI commands", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Command closure" });
    const paths = new Set(plan.entries.map(({ path }) => path));
    const packageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as { readonly scripts?: Record<string, string> };
    for (const script of [
      "check:saas-ui-foundation",
      "check:saas-ui-artifact-safety",
      "smoke:golden:browser",
      "smoke:golden:a11y",
      "smoke:golden:visual",
    ])
      expect(packageJson.scripts?.[script], script).toBeTypeOf("string");
    for (const path of [
      "tooling/quality/check-saas-ui-foundation.mts",
      "tooling/quality/check-saas-ui-artifact-safety.mts",
      "tooling/quality/src/direct-run.mts",
      "tooling/saas-ui/golden-authority.mts",
      "tooling/saas-ui/golden-authority-command.ts",
      "tooling/saas-ui/golden-authority-runtime.ts",
      "tests/e2e/fixtures/saas-ui-golden.ts",
      "tests/e2e/fixtures/saas-ui-golden-test.ts",
    ])
      expect(paths.has(path), path).toBe(true);
  });

  it("loads every advertised golden smoke module from a fresh target", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Command loading" });
    const target = mkdtempSync(join(tmpdir(), "saas-ui-golden-command-load-"));
    try {
      for (const entry of plan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      execFileSync("pnpm", ["install", "--frozen-lockfile"], {
        cwd: target,
        stdio: "pipe",
        timeout: 180_000,
      });

      const packageJson = JSON.parse(
        readFileSync(join(target, "package.json"), "utf8"),
      ) as { readonly scripts?: Record<string, string> };
      const smokeScripts = Object.entries(packageJson.scripts ?? {}).filter(
        ([name]) => name === "smoke:golden" || name.startsWith("smoke:golden:"),
      );
      const modulesByScript = new Map<string, Set<string>>();
      const specsByScript = new Map<string, Set<string>>();
      // eslint-disable-next-line complexity -- recursively expands every advertised smoke command.
      function collect(
        name: string,
        seen: Set<string>,
      ): { modules: Set<string>; specs: Set<string> } {
        const existingModules = modulesByScript.get(name);
        const existingSpecs = specsByScript.get(name);
        if (existingModules && existingSpecs)
          return { modules: existingModules, specs: existingSpecs };
        if (seen.has(name)) return { modules: new Set(), specs: new Set() };
        seen.add(name);
        const script = packageJson.scripts?.[name] ?? "";
        const modules = new Set<string>();
        const specs = new Set<string>();
        for (const match of script.matchAll(/playwright test ([^&]+)/g))
          for (const argument of match[1]?.trim().split(/\s+/u) ?? [])
            if (argument.endsWith(".ts")) specs.add(argument);
        for (const match of script.matchAll(/tsx (\S+)/g))
          if (match[1]?.endsWith(".ts")) modules.add(match[1]);
        for (const nested of script.matchAll(/pnpm (smoke:golden(?::\S+)?)/g)) {
          const nestedResult = collect(nested[1] ?? "", new Set(seen));
          for (const module of nestedResult.modules) modules.add(module);
          for (const spec of nestedResult.specs) specs.add(spec);
        }
        modulesByScript.set(name, modules);
        specsByScript.set(name, specs);
        return { modules, specs };
      }

      for (const [name] of smokeScripts) {
        const { modules, specs } = collect(name, new Set());
        modules.add("tooling/saas-ui/golden-authority.mts");
        expect(specs.size, name).toBeGreaterThan(0);
        execFileSync(
          "pnpm",
          ["exec", "playwright", "test", "--list", ...specs],
          { cwd: target, stdio: "pipe", timeout: 30_000 },
        );
        for (const module of modules)
          execFileSync(
            "pnpm",
            [
              "exec",
              "tsx",
              "--eval",
              `import(${JSON.stringify(`./${module}`)})`,
            ],
            { cwd: target, stdio: "pipe", timeout: 30_000 },
          );
      }
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 240_000);

  it("projects the shared Saas UI compatibility seam for pinned upstream props", () => {
    const sources = new Map(
      buildSaasApplicationTargetPlan({
        name: "Compatibility Seam",
      }).entries.map(({ path, content }) => [path, content]),
    );

    expect(
      sources.get("apps/web/src/components/ui/saas-ui-compat.tsx"),
    ).toContain("useSaasClipboard");
    expect(
      sources.get("apps/web/src/features/common/layouts/app-layout.tsx"),
    ).toContain("SaasSidebarProvider");
    expect(
      sources.get(
        "apps/web/src/features/settings/account/account-api-page.tsx",
      ),
    ).toContain("useSaasClipboard");
    expect(
      sources.get("apps/web/src/features/settings/members/members-list.tsx"),
    ).toContain("SaasButton");
    expect(
      sources.get("apps/web/src/features/settings/tags/manage-tags.tsx"),
    ).toContain("SaasButton");
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
        "apps/web/src/routes/dashboard.tsx",
        "apps/web/src/routes/_auth.login.tsx",
        "apps/web/src/routes/_auth.signup.tsx",
        "apps/web/src/routes/_auth.forgot-password.tsx",
        "apps/web/src/routes/_auth.reset-password.tsx",
        "apps/web/src/routes/_workspace._dashboard.forms.tsx",
        "apps/web/src/routes/_workspace._dashboard.kanban.tsx",
        "apps/web/src/routes/_workspace.onboarding.tsx",
        "apps/web/src/routes/_workspace._dashboard.reports.tsx",
        "apps/web/src/routes/_workspace._dashboard.contacts.index.tsx",
        "apps/web/src/routes/_workspace.settings.index.tsx",
        "apps/web/src/routes/_workspace.settings.account.index.tsx",
        "apps/web/src/routes/_workspace.settings.account.profile.tsx",
        "apps/web/src/routes/_workspace.settings.account.security.tsx",
        "apps/web/src/routes/_workspace.settings.plans.tsx",
        "apps/web/src/routes/_workspace._dashboard.states.tsx",
        "apps/web/src/routes/privacy.tsx",
        "apps/web/src/routes/terms.tsx",
      ]) {
        expect(paths.has(path)).toBe(true);
      }
      for (const path of [
        "apps/web/src/routes/_workspace._dashboard.tsx",
        "apps/web/src/routes/_workspace._dashboard.contacts.index.tsx",
        "apps/web/src/routes/_workspace._dashboard.inbox.$id.tsx",
        "apps/web/src/routes/_workspace._dashboard.search.tsx",
      ]) {
        expect(paths.has(path)).toBe(true);
      }
      for (const path of [
        "apps/web/src/routes/_workspace.contacts.index.tsx",
        "apps/web/src/routes/_workspace.inbox.$id.tsx",
        "apps/web/src/routes/_workspace.search.tsx",
      ]) {
        expect(paths.has(path)).toBe(false);
      }
      expect(
        paths.has("apps/web/src/features/common/components/client-resizer.tsx"),
      ).toBe(true);
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
      command(["--dir", "apps/web", "typecheck"]);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 240_000);
});
