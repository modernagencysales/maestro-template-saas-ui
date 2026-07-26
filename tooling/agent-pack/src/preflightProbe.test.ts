import { describe, expect, it, vi } from "vitest";
import { createComposedPreflightProbe } from "./preflightProbe.js";
import { createRepositoryContext } from "./repoContext.js";

const repo = createRepositoryContext({
  cwd: "/workspace/app",
  sourceRoot: ".",
  templateRoot: "../template",
  targetRoot: ".",
});

const runtimeFacts = {
  host: {
    os: "linux",
    architecture: "x64",
    osSupported: true,
    node: { current: "22.20.0", required: ">=22", supported: true },
    pnpm: { current: "10.12.1", required: "10.12.1", supported: true },
    corepack: "ready" as const,
    git: {
      current: "2.50.0",
      required: "worktree support",
      supported: true,
      worktree: true,
    },
  },
  prerequisites: {
    dependencies: "installed" as const,
    disk: "ready" as const,
    ports: "not-required" as const,
  },
  repository: {
    role: "existing-app" as const,
    rootRoles: {
      source: "existing-app" as const,
      template: "immutable-template" as const,
      target: "existing-app" as const,
    },
    commit: "abc1234",
    gitRoot: "/workspace/app",
    rootMatches: true,
    canonicalBase: "main",
    canonicalTag: "v1.0.0",
    dirty: false,
    generatedDrift: false,
    collisions: [],
    hostIntegration: "current" as const,
  },
  network: "offline" as const,
  auth: "not-required" as const,
  versionsCompatible: true,
  versions: {
    pack: "1",
    cli: "1",
    template: "1",
    convex: "1.42.1",
    workflow: "1",
    workpool: "0.3.0",
    confect: "9.1.5",
    effect: "3.21.4",
  },
  workflow: {
    status: "restricted" as const,
    accepted: ["Date.now"],
    restricted: ["Intl"],
    unsupported: ["crypto"],
    publishedDrift: false,
    rerun: "pnpm check:workflow:fast" as const,
  },
  availableEnvironmentNames: ["CONVEX_DEPLOYMENT"],
  environmentBinding: "environment_binding_sha256:fixture",
  templateInstanceText: JSON.stringify({ name: "App" }),
};

describe("composed preflight probe", () => {
  it("composes canonical readers with one read-only runtime snapshot", async () => {
    const instance = {
      blueprint: "source-grounded-gtm-brain",
      modules: ["brain", "workflows", "capabilities", "api", "mcp"],
      providerMode: "test" as const,
      providers: {
        convex: "configured" as const,
        workos: "fake" as const,
        posthog: "fake" as const,
        dodo: "fake" as const,
        email: "console" as const,
        llm: "fake" as const,
        storage: "local" as const,
      },
    };
    const readers = {
      parseTemplateInstance: vi.fn(() => instance),
      buildTemplateInstance: vi.fn(() => instance),
      doctorTemplateInstance: vi.fn(() => ({ ok: true, checks: [] })),
      readSystemCatalog: vi.fn(() => ({ systems: [] })),
      readDataResourceCatalog: vi.fn(() => ({ resources: [] })),
      readProductTopology: vi.fn(() => ({ systems: [] })),
      buildBlueprintCatalog: vi.fn(() => [{ id: "source-grounded-gtm-brain" }]),
      requiredEnvNamesForProvider: vi.fn((provider: string) =>
        provider === "convex" ? ["CONVEX_DEPLOYMENT"] : [],
      ),
    };
    const probe = createComposedPreflightProbe({
      runtime: { inspect: vi.fn(async () => runtimeFacts) },
      readers,
    });

    await expect(probe.inspect({ mode: "test" }, repo)).resolves.toMatchObject({
      fingerprintBinding: "environment_binding_sha256:fixture",
      facts: {
        repository: { role: "existing-app", commit: "abc1234" },
        network: "offline",
        workflow: { status: "restricted", restricted: ["Intl"] },
        app: {
          blueprint: "source-grounded-gtm-brain",
          providerMode: "test",
          providers: expect.arrayContaining([
            { id: "convex", posture: "test" },
            { id: "workos", posture: "missing" },
          ]),
        },
        indexes: {
          systems: "docs/template/system-catalog.json",
          generators: "tooling/generators/src/index.ts",
        },
      },
    });
    expect(readers.parseTemplateInstance).toHaveBeenCalledOnce();
    expect(readers.doctorTemplateInstance).toHaveBeenCalledWith(
      instance,
      expect.objectContaining({ mode: "test", repoRoot: repo.sourceRoot }),
    );
    expect(readers.readSystemCatalog).toHaveBeenCalledWith(repo.templateRoot);
  });

  it("uses the canonical default builder for a greenfield target", async () => {
    const instance = {
      blueprint: "source-grounded-gtm-brain",
      modules: [],
      providerMode: "fake" as const,
      providers: {},
    };
    const buildTemplateInstance = vi.fn(() => instance);
    const probe = createComposedPreflightProbe({
      runtime: {
        inspect: async () => ({
          ...runtimeFacts,
          repository: {
            ...runtimeFacts.repository,
            role: "greenfield" as const,
          },
          templateInstanceText: undefined,
        }),
      },
      readers: {
        parseTemplateInstance: vi.fn(),
        buildTemplateInstance,
        doctorTemplateInstance: () => ({ ok: true, checks: [] }),
        readSystemCatalog: () => ({}),
        readDataResourceCatalog: () => ({}),
        readProductTopology: () => ({}),
        buildBlueprintCatalog: () => [{ id: instance.blueprint }],
        requiredEnvNamesForProvider: () => [],
      },
    });

    const observation = await probe.inspect({ mode: "fake" }, repo);
    expect(buildTemplateInstance).toHaveBeenCalledWith({
      providerMode: "fake",
      generatedAt: "1970-01-01T00:00:00.000Z",
    });
    expect("facts" in observation && observation.facts.app.providers).toEqual(
      [],
    );
  });
});
