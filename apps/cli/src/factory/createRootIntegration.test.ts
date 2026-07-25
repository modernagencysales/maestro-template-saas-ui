import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCliAsync } from "../index";
import { CREATE_HELP } from "./create";
import { createFactoryCliComposition } from "./composition";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("create root integration", () => {
  it("preserves alpha.1 and pins the executable release manifests", () => {
    const digest = (path: string) =>
      `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
    expect(
      digest(join(repoRoot, "releases/v0.1.0-alpha.1/manifest.json")),
    ).toBe(
      "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93",
    );
    expect(
      digest(join(repoRoot, "releases/v0.2.0-alpha.1/manifest.json")),
    ).toBe(
      "sha256:c18fa8307d6c6d50f19fdb83b5bceb8e67b42aaa4c1849ea9ac83dd9e8233c74",
    );
    expect(
      digest(
        join(
          repoRoot,
          "releases/v0.2.0-alpha.1/blueprints/saas-application.json",
        ),
      ),
    ).toBe(
      "sha256:2ccf27cc7d35d4008410e654b2ef13a0baea5cb1ff8d0dd05eedf80ebe934ae7",
    );
  });

  it("registers the exact seven-command factory inventory", () => {
    expect(
      createFactoryCliComposition(() => ({})).handlers.map(
        ({ command }) => command,
      ),
    ).toEqual([
      "create",
      "start",
      "preflight",
      "verify",
      "check",
      "plan-check",
      "scaffold",
    ]);
  });

  it("routes the exact create help", async () => {
    await expect(
      runCliAsync(["create", "--help"], undefined, repoRoot),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: CREATE_HELP,
      stderr: "",
    });
    expect((await runCliAsync(["help"])).stdout).toContain(CREATE_HELP.trim());
  });

  it("resolves the reviewed SaaS release in a non-mutating default preview", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-root-"));
    temporaryRoots.push(parent);
    const target = join(parent, "customer-app");
    const result = await runCliAsync(
      [
        "create",
        target,
        "--name",
        "My App",
        "--outcome",
        "Track client requests",
        "--json",
      ],
      undefined,
      repoRoot,
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      diagnostics: [],
      data: { release: { version: "0.2.0-alpha.1" } },
    });
    expect(existsSync(target)).toBe(false);
  });

  it("pins the release workspace dependency in package and lock importer", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "apps/cli/package.json"), "utf8"),
    );
    expect(packageJson.dependencies["@maestro-template/release-tooling"]).toBe(
      "workspace:*",
    );
    expect(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8")).toContain(
      [
        '      "@maestro-template/release-tooling":',
        "        specifier: workspace:*",
        "        version: link:../../tooling/release",
      ].join("\n"),
    );
  });

  it("materializes and compiles the canonical SaaS registries in the customer target", async () => {
    const parent = mkdtempSync(join(tmpdir(), "maestro-create-workspace-"));
    temporaryRoots.push(parent);
    const targetRoot = join(parent, "app");
    const result = await runCliAsync(
      [
        "create",
        targetRoot,
        "--name",
        "My App",
        "--outcome",
        "Create and review records",
        "--write",
        "--json",
      ],
      undefined,
      repoRoot,
    );
    expect(result.exitCode, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ exitClass: "success" });
    const required = [
      "packages/convex/confect/tables/records.ts",
      "packages/convex/confect/records/records.spec.ts",
      "packages/convex/confect/records/records.impl.ts",
      "apps/web/src/adapters/records/contract.ts",
      "apps/web/src/adapters/records/fake.ts",
      "apps/web/src/features/records/records-surface.tsx",
      "apps/web/src/screens/records-screen.tsx",
      "apps/web/src/routes/_workspace.records.tsx",
    ] as const;
    for (const path of required) {
      expect(existsSync(join(targetRoot, path))).toBe(true);
    }
    const instance = JSON.parse(
      readFileSync(join(targetRoot, "template-instance.json"), "utf8"),
    );
    expect(instance).toMatchObject({
      blueprint: {
        id: "saas-application",
        digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        provenance: "@maestro-template/generators/saas-application@1",
      },
      personalization: {
        name: "My App",
        firstOutcome: "Create and review records",
      },
    });
    symlinkSync(
      join(repoRoot, "node_modules"),
      join(targetRoot, "node_modules"),
      "dir",
    );
    for (const project of ["packages/convex", "apps/web"]) {
      symlinkSync(
        join(repoRoot, project, "node_modules"),
        join(targetRoot, project, "node_modules"),
        "dir",
      );
    }
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsc",
        "-p",
        join(targetRoot, "packages/convex/tsconfig.json"),
        "--outDir",
        join(targetRoot, "packages/convex/dist"),
        "--declaration",
      ],
      { cwd: targetRoot, stdio: "pipe" },
    );
    const webTargetConfig = join(parent, "web-target-tsconfig.json");
    writeFileSync(
      webTargetConfig,
      JSON.stringify({
        extends: join(targetRoot, "apps/web/tsconfig.json"),
        compilerOptions: {
          baseUrl: targetRoot,
          paths: {
            "@maestro-template/convex/refs": [
              "packages/convex/dist/src/refs.d.ts",
            ],
          },
        },
      }),
    );
    execFileSync("pnpm", ["exec", "tsc", "-p", webTargetConfig, "--noEmit"], {
      cwd: targetRoot,
      stdio: "pipe",
    });

    const databaseSchema = (await import(
      `${pathToFileURL(join(targetRoot, "packages/convex/confect/_generated/schema.ts")).href}?target=${Date.now()}`
    )) as { readonly default: { readonly tables: Record<string, unknown> } };
    expect(databaseSchema.default.tables).toHaveProperty("records");
    const spec = (await import(
      `${pathToFileURL(join(targetRoot, "packages/convex/confect/_generated/spec.ts")).href}?target=${Date.now()}`
    )) as { readonly default: unknown };
    expect(JSON.stringify(spec.default)).toContain('"records"');
    for (const operation of ["list", "read", "create"]) {
      expect(JSON.stringify(spec.default)).toContain(`"${operation}"`);
    }
    const routes = (await import(
      `${pathToFileURL(join(targetRoot, "apps/web/src/routeRegistry.generated.ts")).href}?target=${Date.now()}`
    )) as {
      readonly saasApplicationRoutes: { readonly records: string };
    };
    expect(routes.saasApplicationRoutes.records).toBe("/records");

    const targetAdapter = (await import(
      `${
        pathToFileURL(join(targetRoot, "apps/web/src/adapters/records/fake.ts"))
          .href
      }?target=${Date.now()}`
    )) as {
      readonly createFakeRecordAdapter: () => {
        readonly create: (input: {
          readonly workspaceId: string;
          readonly title: string;
          readonly detail: string;
        }) => Promise<{ readonly id: string }>;
        readonly list: (workspaceId: string) => Promise<readonly unknown[]>;
        readonly read: (workspaceId: string, id: string) => Promise<unknown>;
      };
    };
    const records = targetAdapter.createFakeRecordAdapter();
    const created = await records.create({
      workspaceId: "workspace_a",
      title: "First record",
      detail: "Materialized target import resolved.",
    });
    expect(await records.list("workspace_a")).toHaveLength(1);
    expect(await records.read("workspace_a", created.id)).toMatchObject({
      title: "First record",
    });
    expect(await records.read("workspace_b", created.id)).toBeNull();
  }, 120_000);
});
