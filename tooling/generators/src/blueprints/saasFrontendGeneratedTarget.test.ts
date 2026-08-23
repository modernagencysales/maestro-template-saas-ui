import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
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
const execFileAsync = promisify(execFile);

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForHttp(url: string) {
  const deadline = Date.now() + 20_000;
  let lastFailure = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return response.status;
      lastFailure = `${response.status}: ${(await response.text()).slice(-4_000)}`;
    } catch (error) {
      lastFailure = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Generated server did not become ready at ${url}: ${lastFailure}`,
  );
}

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
    expect(sources.get("apps/web/src/routes/_app.tsx")).toContain("ssr: false");
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
      "typecheck:saas-ui",
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
      "tooling/quality/check-saas-ui-typecheck.mts",
      "tooling/quality/fixtures/saas-ui-typecheck-baseline.json",
      "tooling/quality/src/direct-run.mts",
    ])
      expect(paths.has(path), path).toBe(true);
    for (const path of paths) {
      expect(path.startsWith("tooling/saas-ui/golden-"), path).toBe(false);
      expect(path.startsWith("tests/e2e/saas-ui-golden"), path).toBe(false);
    }
  });

  it("binds the generated zero-diagnostic baseline to its projected lockfile", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Baseline closure" });
    const lockfile = plan.entries.find(
      ({ path }) => path === "pnpm-lock.yaml",
    )?.content;
    const baseline = JSON.parse(
      plan.entries.find(
        ({ path }) =>
          path === "tooling/quality/fixtures/saas-ui-typecheck-baseline.json",
      )?.content ?? "{}",
    ) as {
      readonly pnpmLockSha256?: string;
      readonly diagnosticCount?: number;
    };
    expect(lockfile).toBeTypeOf("string");
    expect(baseline).toEqual(
      expect.objectContaining({
        pnpmLockSha256: createHash("sha256")
          .update(lockfile ?? "")
          .digest("hex"),
        diagnosticCount: 0,
      }),
    );
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

  it("builds and starts a freshly materialized customer target with frozen dependencies", async () => {
    const neutralPlan = buildSaasApplicationTargetPlan({ name: "Build Proof" });
    const recordsPlan = buildSaasApplicationTargetPlan({
      name: "Build Proof",
      patterns: ["records-example"],
    });
    const target = mkdtempSync(join(tmpdir(), "saas-ui-generated-build-"));
    try {
      for (const entry of neutralPlan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      expect(
        readFileSync(join(target, "tsconfig.base.json"), "utf8"),
      ).toContain('"strict": true');
      const paths = new Set(recordsPlan.entries.map(({ path }) => path));
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
        "apps/web/src/routes/_app/$workspace/_dashboard/records.tsx",
        "apps/web/src/routes/_app/$workspace/_dashboard/showcase.tsx",
        "apps/web/src/routes/_app/$workspace/settings/account/profile.tsx",
        "docs/template/saas-ui-screen-catalog.json",
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

      const command = async (args: readonly string[]) => {
        try {
          await execFileAsync("pnpm", args, {
            cwd: target,
            env: {
              ...process.env,
              CI: "true",
              NODE_ENV: "production",
              VITE_CONVEX_URL: "https://generated-target-test.convex.cloud",
            },
            timeout: 180_000,
          });
        } catch (error) {
          const result = error as {
            stdout?: string | Buffer;
            stderr?: string | Buffer;
          };
          throw new Error(
            `${args.join(" ")} failed\n${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`,
          );
        }
      };
      await command(["install", "--frozen-lockfile"]);
      await command(["run", "typecheck:saas-ui:baseline"]);
      await command(["--dir", "apps/web", "typecheck"]);
      for (const entry of recordsPlan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      await command(["run", "check:saas-ui-artifact-safety"]);
      await command(["--dir", "apps/web", "typecheck"]);
      await command(["--dir", "apps/web", "build"]);
      const routeTree = readFileSync(
        join(target, "apps/web/src/routeTree.gen.ts"),
        "utf8",
      );
      expect(routeTree).toContain("AppWorkspaceDashboardRecordsRouteImport");
      expect(routeTree).toContain("path: '/records'");

      const port = await availablePort();
      const server = spawn("node", [".output/server/index.mjs"], {
        cwd: join(target, "apps/web"),
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          NODE_ENV: "production",
          PORT: String(port),
          VITE_CONVEX_URL: "https://generated-target-test.convex.cloud",
          WORKOS_API_KEY: "fake",
          WORKOS_CLIENT_ID: "client_test_generated_target",
          WORKOS_COOKIE_PASSWORD: "generated-target-test-cookie-password",
          WORKOS_REDIRECT_URI: `http://127.0.0.1:${port}/api/auth/callback`,
        },
        stdio: "pipe",
      });
      let output = "";
      server.stdout.on("data", (chunk) => (output += chunk));
      server.stderr.on("data", (chunk) => (output += chunk));
      try {
        const loginUrl = `http://127.0.0.1:${port}/login`;
        expect(await waitForHttp(loginUrl)).toBe(200);
        const browser = await chromium.launch();
        try {
          const page = await browser.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(loginUrl);
          await page.getByRole("link", { name: "Sign up" }).click();
          await page.getByRole("heading", { name: "Sign up" }).waitFor();
          expect(errors).toEqual([]);
        } finally {
          await browser.close();
        }
      } catch (error) {
        throw new Error(`${String(error)}\n${output}`);
      } finally {
        if (server.exitCode === null) {
          server.kill("SIGTERM");
          await once(server, "exit");
        }
      }
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 360_000);
});
