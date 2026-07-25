import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createCustomerCreateCommand,
  createRepositoryContext,
  executeAgentPackCommand,
} from "@maestro-template/agent-pack";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
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

  it("keeps default preview non-mutating and fails closed for the fixture-only release", async () => {
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

    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutationPosture: "preview",
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_CREATE_RELEASE_UNAVAILABLE" }],
      data: null,
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

  it("materializes and executes the SaaS overlay in the customer target", async () => {
    const fixtures = (await import(
      new URL(
        "../../../../tooling/release/src/customerTarget/createAdapter.testFixtures.ts",
        import.meta.url,
      ).href
    )) as {
      readonly taggedRelease: () => {
        readonly repositoryRoot: string;
        readonly targetRoot: string;
      };
      readonly adapter: (fixture: unknown) => {
        readonly prepare: (request: unknown) => Promise<unknown>;
        readonly materialize: (
          token: unknown,
          fingerprint: string,
        ) => Promise<unknown>;
      };
    };
    const fixture = fixtures.taggedRelease();
    const release = fixtures.adapter(fixture);
    const command = createCustomerCreateCommand({
      blueprintTargetPlan: ({ name, outcome }) =>
        buildSaasApplicationTargetPlan({ name, firstOutcome: outcome }),
      release: release as Parameters<
        typeof createCustomerCreateCommand
      >[0]["release"],
    });
    const result = await executeAgentPackCommand(
      command,
      {
        target: fixture.targetRoot,
        name: "My App",
        outcome: "Create and review records",
        write: true,
      },
      {
        schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
        invocation: "library",
        repo: createRepositoryContext({ cwd: fixture.repositoryRoot }),
      },
    );

    expect(result.exitClass).toBe("success");
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
      expect(existsSync(join(fixture.targetRoot, path))).toBe(true);
    }
    const instance = JSON.parse(
      readFileSync(join(fixture.targetRoot, "template-instance.json"), "utf8"),
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
    expect(
      readFileSync(
        join(fixture.targetRoot, "packages/convex/confect/tables/records.ts"),
        "utf8",
      ),
    ).toContain('.index("by_workspace", ["workspaceId"])');
    expect(
      readFileSync(
        join(
          fixture.targetRoot,
          "packages/convex/confect/records/records.spec.ts",
        ),
        "utf8",
      ),
    ).toContain('operationId: "records.create"');
    expect(
      readFileSync(
        join(fixture.targetRoot, "apps/web/src/routes/_workspace.records.tsx"),
        "utf8",
      ),
    ).toContain('createFileRoute("/_workspace/records")');

    const targetAdapter = (await import(
      `${
        pathToFileURL(
          join(fixture.targetRoot, "apps/web/src/adapters/records/fake.ts"),
        ).href
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
  });
});
