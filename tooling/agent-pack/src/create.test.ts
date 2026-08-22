import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createCustomerCreateCommand,
  type CustomerCreateDependencies,
  type CustomerCreateReleaseFacts,
} from "./create.js";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
} from "./contracts.js";
import { createRepositoryContext } from "./repoContext.js";
import { createStartCommand, type StartDependencies } from "./start.js";

const facts: CustomerCreateReleaseFacts = {
  version: "0.1.0-alpha.1",
  tag: "maestro-template-v0.1.0-alpha.1",
  sourceCommit: "a".repeat(40),
  sourceChecksum: `sha256:${"b".repeat(64)}`,
  cliCompatibility: ">=0.1.0-alpha.1 <0.2.0",
  agentPackCompatibility: ">=0.1.0-alpha.1 <0.2.0",
  ownershipManifest: "releases/v0.1.0-alpha.1/manifest.json",
  ownershipManifestChecksum: `sha256:${"c".repeat(64)}`,
  extensionSeams: ["customer/extensions"],
};

const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/factory" }),
};

const blueprint = {
  schemaVersion: 1 as const,
  id: "saas-application",
  digest: `sha256:${"e".repeat(64)}`,
  provenance: "@maestro-template/generators/saas-application@1",
  registrations: [
    "apps/web/src/routes/_workspace.records.tsx",
    "docs/template/agent-pack-privacy.md",
  ],
  entries: [],
};

function fixture(options: { readonly collisions?: readonly string[] } = {}) {
  let instance = "";
  const materialize = vi.fn(async () => ({ ok: true as const, files: 3 }));
  const dependencies: CustomerCreateDependencies = {
    blueprintTargetPlan: () => blueprint,
    release: {
      prepare: vi.fn(async (request) => {
        instance = request.templateInstance(facts, blueprint);
        return {
          ok: true as const,
          token: { release: facts.tag },
          facts,
          preview: {
            preflightFingerprint: `sha256:${"d".repeat(64)}`,
            writes: [
              { path: "package.json", bytes: 20 },
              { path: "template-instance.json", bytes: instance.length },
            ],
            omissions: ["docs/superpowers"],
            collisions: options.collisions ?? [],
            totalBytes: 20 + instance.length,
          },
        };
      }),
      materialize,
    },
  };
  return { dependencies, materialize, instance: () => instance };
}

const input = {
  target: "../my-app",
  name: "My App",
  outcome: "Track client requests",
  demoOnly: true,
};

describe("customer create command", () => {
  it("previews exact release writes and personalized instance facts by default", async () => {
    const test = fixture();
    const result = await executeAgentPackCommand(
      createCustomerCreateCommand(test.dependencies),
      input,
      context,
    );

    expect(result.exitClass).toBe("success");
    expect(result.mutationPosture).toBe("preview");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "AGENT_PACK_PRIVACY_FIRST_RUN",
        severity: "info",
        rerun:
          'pnpm maestro -- create "../my-app" --name "My App" --outcome "Track client requests" --demo-only --write',
      }),
    ]);
    expect(test.materialize).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      privacy: {
        maestro: { productTelemetry: "none", automaticUpload: false },
        host: { kind: "unknown" },
        providers: { explicitOptInRequired: true },
      },
      preview: {
        writes: [
          { path: "package.json", bytes: 20 },
          { path: "template-instance.json", bytes: expect.any(Number) },
        ],
        omissions: ["docs/superpowers"],
        collisions: [],
      },
      nextCommand: 'pnpm --dir "../my-app" maestro -- start --mode fake',
      followUpActions: [
        {
          id: "git-init",
          command: 'git -C "../my-app" init',
          requiresApproval: true,
          executed: false,
        },
        {
          id: "install",
          command:
            'npx --yes pnpm@10.12.1 --dir "../my-app" install --frozen-lockfile',
          requiresApproval: true,
          executed: false,
        },
        {
          id: "install",
          command: 'pnpm --dir "../my-app" install --frozen-lockfile',
          requiresApproval: true,
          executed: false,
        },
        {
          id: "git-add",
          command: 'git -C "../my-app" add .',
          requiresApproval: true,
          executed: false,
        },
        {
          id: "git-commit",
          command:
            'git -C "../my-app" commit -m "chore: initialize app from Maestro"',
          requiresApproval: true,
          executed: false,
        },
        {
          id: "preflight",
          command: 'pnpm --dir "../my-app" maestro -- preflight --mode fake',
          requiresApproval: true,
          executed: false,
        },
      ],
    });
    expect(JSON.parse(test.instance())).toMatchObject({
      schemaVersion: 1,
      release: {
        tag: facts.tag,
        sourceCommit: facts.sourceCommit,
        sourceChecksum: facts.sourceChecksum,
      },
      ownership: {
        manifest: facts.ownershipManifest,
        manifestChecksum: facts.ownershipManifestChecksum,
      },
      blueprint: {
        id: "saas-application",
        workflowPosture: "optional-unavailable",
      },
      personalization: {
        name: "My App",
        firstOutcome: "Track client requests",
        demoOnly: true,
      },
      customerExtension: {
        privacy: {
          maestro: { productTelemetry: "none", automaticUpload: false },
          privacyDocument: "docs/template/agent-pack-privacy.md",
        },
      },
    });
  });

  it("creates a separate personalized SaaS target before starting it", async () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-create-start-"));
    const factoryRoot = join(root, "factory");
    const targetRoot = join(root, "customer-app");
    mkdirSync(factoryRoot);
    let instance = "";
    const create = createCustomerCreateCommand({
      blueprintTargetPlan: () => blueprint,
      release: {
        prepare: vi.fn(async (request) => {
          instance = request.templateInstance(facts, blueprint);
          return {
            ok: true as const,
            token: {},
            facts,
            preview: {
              preflightFingerprint: `sha256:${"d".repeat(64)}`,
              writes: [
                { path: "template-instance.json", bytes: instance.length },
              ],
              omissions: [],
              collisions: [],
              totalBytes: instance.length,
            },
          };
        }),
        materialize: vi.fn(async () => {
          mkdirSync(targetRoot);
          writeFileSync(join(targetRoot, "template-instance.json"), instance);
          return { ok: true as const, files: 1 };
        }),
      },
    });
    try {
      const created = await executeAgentPackCommand(
        create,
        {
          target: targetRoot,
          name: "My App",
          outcome: "Create and review records",
          write: true,
        },
        {
          ...context,
          repo: createRepositoryContext({ cwd: factoryRoot }),
        },
      );
      expect(created.exitClass).toBe("success");
      expect(
        JSON.parse(
          readFileSync(join(targetRoot, "template-instance.json"), "utf8"),
        ),
      ).toMatchObject({
        blueprint: { id: "saas-application" },
        personalization: {
          name: "My App",
          firstOutcome: "Create and review records",
        },
      });

      const startDependencies: StartDependencies = {
        preflight: vi.fn(async () => ({
          safeToStart: true,
          auth: "not-required" as const,
          exitClass: "success" as const,
          diagnostics: [],
          readiness: {
            worksNow: "Fake records work now.",
            demoOnly: "Live connections are demo-only.",
            blueprint: "saas-application",
            providers: [{ id: "convex", posture: "sample" as const }],
          },
        })),
        readFile: vi.fn(async (path) => readFileSync(path, "utf8")),
        ports: { available: vi.fn(async () => true) },
        readiness: { wait: vi.fn(async () => true) },
        readinessSurface: {
          open: vi.fn(async () => ({
            url: "http://127.0.0.1:4174/",
            close: vi.fn(async () => undefined),
          })),
        },
        supervise: vi.fn(async (_specs, readiness) => {
          readiness.onReady();
          return { kind: "user-signal" as const, signal: "SIGINT" as const };
        }),
        announce: vi.fn(),
      };
      const started = await executeAgentPackCommand(
        createStartCommand(startDependencies),
        { mode: "fake" },
        {
          ...context,
          repo: createRepositoryContext({ cwd: targetRoot }),
        },
      );
      expect(started.exitClass).toBe("success");
      expect(vi.mocked(startDependencies.supervise).mock.calls[0]?.[0]).toEqual(
        [expect.objectContaining({ cwd: targetRoot, id: "web" })],
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes only when explicitly requested and never runs install or git init", async () => {
    const test = fixture();
    const result = await executeAgentPackCommand(
      createCustomerCreateCommand(test.dependencies),
      { ...input, write: true },
      context,
    );

    expect(result.exitClass).toBe("success");
    expect(result.mutationPosture).toBe("write");
    expect(test.materialize).toHaveBeenCalledOnce();
    expect(result.data).toMatchObject({ materializedFiles: 3 });
    expect(result.diagnostics[0]?.rerun).toBe(
      'pnpm --dir "../my-app" maestro -- preflight --mode fake',
    );
  });

  it("fails closed for fixture-only or unresolved release bindings", async () => {
    const dependencies: CustomerCreateDependencies = {
      blueprintTargetPlan: () => blueprint,
      release: {
        prepare: vi.fn(async () => ({
          ok: false as const,
          code: "release-unavailable" as const,
          message:
            "Release manifest is fixture-only until its tag is externally resolved.",
        })),
        materialize: vi.fn(),
      },
    };
    const result = await executeAgentPackCommand(
      createCustomerCreateCommand(dependencies),
      input,
      context,
    );

    expect(result.exitClass).toBe("blockedMutation");
    expect(result.diagnostics[0]?.code).toBe(
      "AGENT_PACK_CREATE_RELEASE_UNAVAILABLE",
    );
    expect(dependencies.release.materialize).not.toHaveBeenCalled();
  });

  it("shows collisions in preview and refuses the write", async () => {
    const preview = fixture({ collisions: ["package.json"] });
    const previewResult = await executeAgentPackCommand(
      createCustomerCreateCommand(preview.dependencies),
      input,
      context,
    );
    expect(previewResult.exitClass).toBe("findings");
    expect(previewResult.data).toMatchObject({
      preview: { collisions: ["package.json"] },
    });

    const write = fixture({ collisions: ["package.json"] });
    const writeResult = await executeAgentPackCommand(
      createCustomerCreateCommand(write.dependencies),
      { ...input, write: true },
      context,
    );
    expect(writeResult.exitClass).toBe("blockedMutation");
    expect(write.materialize).not.toHaveBeenCalled();
  });

  it("accepts only target, name, outcome, demo-only, and writes", async () => {
    const test = fixture();
    for (const invalid of [
      { ...input, provider: "live" },
      { ...input, authenticate: true },
      { ...input, install: true },
      { ...input, name: " " },
      { ...input, outcome: "" },
      { ...input, privacyReviewed: true },
    ]) {
      const result = await executeAgentPackCommand(
        createCustomerCreateCommand(test.dependencies),
        invalid,
        context,
      );
      expect(result.exitClass).toBe("invalidInvocation");
    }
    expect(test.dependencies.release.prepare).not.toHaveBeenCalled();
  });
});
