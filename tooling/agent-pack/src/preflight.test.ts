import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import {
  createPreflightCommand,
  fingerprintPreflight,
  mutationBlockingPreflightCodes,
  type PreflightFacts,
} from "./preflight.js";
import { createRepositoryContext } from "./repoContext.js";

const context = {
  schemaVersion: 1 as const,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/fixture" }),
};

const readyFacts = (): PreflightFacts => ({
  host: {
    os: "linux",
    architecture: "x64",
    osSupported: true,
    node: { current: "22.23.2", required: "22.23.2", supported: true },
    pnpm: { current: "10.12.1", required: "10.12.1", supported: true },
    corepack: "ready",
    git: {
      current: "2.45.0",
      required: ">=2.40.0",
      worktree: true,
      supported: true,
    },
  },
  prerequisites: { dependencies: "installed", disk: "ready", ports: "ready" },
  repository: {
    role: "canonical-clone",
    rootRoles: {
      source: "canonical",
      template: "immutable-template",
      target: "canonical",
    },
    commit: "abc123",
    gitRoot: "/fixture",
    rootMatches: true,
    canonicalBase: "main",
    canonicalTag: "pack-v1",
    dirty: false,
    generatedDrift: false,
    collisions: [],
    hostIntegration: "current",
  },
  network: "online",
  auth: "not-required",
  versionsCompatible: true,
  versions: {
    pack: "1.0.0",
    cli: "1.0.0",
    template: "abc123",
    convex: "1.25.4",
    workflow: "0.3.3",
    workpool: "0.3.3",
    confect: "0.8.0",
    effect: "3.17.7",
  },
  workflow: {
    status: "supported",
    accepted: ["query"],
    restricted: ["retry"],
    unsupported: [],
    publishedDrift: false,
    rerun: "pnpm check:workflow:fast",
  },
  app: {
    blueprint: "source-grounded-gtm-brain",
    modules: ["brain", "workflows"],
    providerMode: "fake",
    providers: [{ id: "llm", posture: "sample" }],
  },
  indexes: {
    systems: "docs/template/system-catalog.json",
    generators: "tooling/generators/src/index.ts",
    recipes: "package.json",
    documentation: "docs/template",
  },
  claimLevels: ["fake", "local", "dev", "preview", "staging", "production"],
});

describe("agent-pack preflight", () => {
  it("accounts for every retained mutation-blocking denial", () => {
    expect(mutationBlockingPreflightCodes).toEqual([
      "AGENT_PACK_OS_UNSUPPORTED",
      "AGENT_PACK_NODE_UNSUPPORTED",
      "AGENT_PACK_PNPM_UNSUPPORTED",
      "AGENT_PACK_GIT_UNSUPPORTED",
      "AGENT_PACK_INSTALL_MISSING",
      "AGENT_PACK_REPO_AMBIGUOUS",
      "AGENT_PACK_DIRTY_OVERLAP",
      "AGENT_PACK_VERSION_INCOMPATIBLE",
      "AGENT_PACK_DISK_LOW",
      "AGENT_PACK_PORT_BLOCKED",
      "AGENT_PACK_GENERATED_DRIFT",
      "AGENT_PACK_GENERATED_DRIFT_UNKNOWN",
      "AGENT_PACK_GIT_ROOT_MISMATCH",
      "AGENT_PACK_GIT_ROOT_UNKNOWN",
      "AGENT_PACK_DIRTY_STATE_UNKNOWN",
      "AGENT_PACK_COLLISIONS_UNKNOWN",
      "AGENT_PACK_WORKFLOW_UNSAFE",
      "AGENT_PACK_PROVIDER_MISSING",
    ]);
  });

  it("accepts supported standalone pnpm when Corepack is unavailable", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({
        inspect: async () => ({
          ...facts,
          host: { ...facts.host, corepack: "missing" },
        }),
      }),
      { mode: "fake" },
      context,
    );

    expect(result.diagnostics.map(({ code }) => code)).not.toContain(
      "AGENT_PACK_PNPM_UNSUPPORTED",
    );
  });

  it("returns a stable fingerprint and novice orientation", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({ inspect: async () => facts }),
      { mode: "fake" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "success",
      mutationPosture: "read-only",
      diagnostics: [],
      data: {
        fingerprint: fingerprintPreflight(context.repo, facts),
        safeToMutate: true,
        worksNow:
          "What works now: the app uses deterministic in-memory sample data.",
        demoOnly:
          "What is demo-only: provider-backed actions still use sample data.",
        nextAction: "pnpm maestro -- check",
      },
    });
  });

  it("canonicalizes object keys and changes for mutation-relevant facts", () => {
    const facts = readyFacts();
    const reordered = {
      ...facts,
      versions: {
        effect: facts.versions.effect,
        confect: facts.versions.confect,
        workpool: facts.versions.workpool,
        workflow: facts.versions.workflow,
        convex: facts.versions.convex,
        template: facts.versions.template,
        cli: facts.versions.cli,
        pack: facts.versions.pack,
      },
    };

    expect(fingerprintPreflight(context.repo, facts)).toBe(
      fingerprintPreflight(context.repo, reordered),
    );
    expect(fingerprintPreflight(context.repo, facts)).not.toBe(
      fingerprintPreflight(context.repo, {
        ...facts,
        repository: { ...facts.repository, dirty: true },
      }),
    );
    expect(fingerprintPreflight(context.repo, facts)).not.toBe(
      fingerprintPreflight(
        createRepositoryContext({ cwd: "/different-target" }),
        facts,
      ),
    );
  });

  it("binds same-name environment value changes only into the overall fingerprint", () => {
    const facts = readyFacts();
    const first = fingerprintPreflight(
      context.repo,
      facts,
      "environment_binding_sha256:first",
    );
    const second = fingerprintPreflight(
      context.repo,
      facts,
      "environment_binding_sha256:second",
    );

    expect(second).not.toBe(first);
    expect(JSON.stringify(facts)).not.toContain("environment_binding_sha256");
  });

  it("always probes through the injected read-only boundary", async () => {
    const calls: unknown[] = [];
    const command = createPreflightCommand({
      inspect: async (input, repo) => {
        calls.push({ input, repo });
        return readyFacts();
      },
    });

    const result = await executeAgentPackCommand(
      command,
      { mode: "test" },
      context,
    );

    expect(result.mutationPosture).toBe("read-only");
    expect(calls).toEqual([{ input: { mode: "test" }, repo: context.repo }]);
  });

  it("rejects extra invocation fields before probing", async () => {
    let probed = false;
    const command = createPreflightCommand({
      inspect: async () => {
        probed = true;
        return readyFacts();
      },
    });
    const result = await executeAgentPackCommand(
      command,
      { mode: "fake", unknown: true },
      context,
    );
    expect(result.exitClass).toBe("invalidInvocation");
    expect(probed).toBe(false);
  });

  it.each(["greenfield", "canonical-clone", "existing-app"] as const)(
    "accepts an unambiguous %s topology",
    async (role) => {
      const facts = readyFacts();
      const result = await executeAgentPackCommand(
        createPreflightCommand({
          inspect: async () => ({
            ...facts,
            repository: { ...facts.repository, role },
          }),
        }),
        { mode: "fake" },
        context,
      );

      expect(result).toMatchObject({
        exitClass: "success",
        data: { safeToMutate: true },
      });
    },
  );

  it("allows unrelated dirty work when no target path overlaps", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({
        inspect: async () => ({
          ...facts,
          repository: { ...facts.repository, dirty: true, collisions: [] },
        }),
      }),
      { mode: "fake" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "success",
      data: { safeToMutate: true },
    });
  });
  it("does not require workflow semantics when no workflow module is selected", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({
        inspect: async () => ({
          ...facts,
          workflow: {
            ...facts.workflow,
            status: "unsupported",
            publishedDrift: true,
          },
          app: { ...facts.app, modules: ["brain"] },
        }),
      }),
      { mode: "fake" },
      context,
    );

    expect(result.exitClass).toBe("success");
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AGENT_PACK_WORKFLOW_UNSAFE" }),
      ]),
    );
  });

  it.each([
    ["unsupported status", { status: "unsupported" as const }],
    ["published drift", { publishedDrift: true }],
  ])(
    "requires safe workflow semantics for selected workflows with %s",
    async (_label, workflowOverride) => {
      const facts = readyFacts();
      const result = await executeAgentPackCommand(
        createPreflightCommand({
          inspect: async () => ({
            ...facts,
            workflow: { ...facts.workflow, ...workflowOverride },
          }),
        }),
        { mode: "fake" },
        context,
      );

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "AGENT_PACK_WORKFLOW_UNSAFE" }),
        ]),
      );
    },
  );

  it.each([
    [
      "unsupported OS",
      (f: PreflightFacts) => ({
        ...f,
        host: { ...f.host, osSupported: false },
      }),
      "AGENT_PACK_OS_UNSUPPORTED",
    ],
    [
      "unsupported Node",
      (f: PreflightFacts) => ({
        ...f,
        host: { ...f.host, node: { ...f.host.node, supported: false } },
      }),
      "AGENT_PACK_NODE_UNSUPPORTED",
    ],
    [
      "unsupported pnpm",
      (f: PreflightFacts) => ({
        ...f,
        host: { ...f.host, pnpm: { ...f.host.pnpm, supported: false } },
      }),
      "AGENT_PACK_PNPM_UNSUPPORTED",
    ],
    [
      "unsupported Git",
      (f: PreflightFacts) => ({
        ...f,
        host: { ...f.host, git: { ...f.host.git, supported: false } },
      }),
      "AGENT_PACK_GIT_UNSUPPORTED",
    ],
    [
      "missing install",
      (f: PreflightFacts) => ({
        ...f,
        prerequisites: { ...f.prerequisites, dependencies: "missing" as const },
      }),
      "AGENT_PACK_INSTALL_MISSING",
    ],
    [
      "ambiguous roots",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, role: "ambiguous" as const },
      }),
      "AGENT_PACK_REPO_AMBIGUOUS",
    ],
    [
      "Git root mismatch",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, rootMatches: false },
      }),
      "AGENT_PACK_GIT_ROOT_MISMATCH",
    ],
    [
      "dirty overlap",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, dirty: true, collisions: ["apps/web"] },
      }),
      "AGENT_PACK_DIRTY_OVERLAP",
    ],
    [
      "generated drift",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, generatedDrift: true },
      }),
      "AGENT_PACK_GENERATED_DRIFT",
    ],
    [
      "unknown generated drift",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, generatedDrift: "unknown" as const },
      }),
      "AGENT_PACK_GENERATED_DRIFT_UNKNOWN",
    ],
    [
      "incompatible versions",
      (f: PreflightFacts) => ({ ...f, versionsCompatible: false }),
      "AGENT_PACK_VERSION_INCOMPATIBLE",
    ],
    [
      "unsafe workflow semantics",
      (f: PreflightFacts) => ({
        ...f,
        workflow: { ...f.workflow, status: "unsupported" as const },
      }),
      "AGENT_PACK_WORKFLOW_UNSAFE",
    ],
    [
      "low disk",
      (f: PreflightFacts) => ({
        ...f,
        prerequisites: { ...f.prerequisites, disk: "low" as const },
      }),
      "AGENT_PACK_DISK_LOW",
    ],
    [
      "blocked port",
      (f: PreflightFacts) => ({
        ...f,
        prerequisites: { ...f.prerequisites, ports: "blocked" as const },
      }),
      "AGENT_PACK_PORT_BLOCKED",
    ],
    [
      "missing selected provider",
      (f: PreflightFacts) => ({
        ...f,
        app: {
          ...f.app,
          providerMode: "live" as const,
          providers: [{ id: "llm", posture: "missing" as const }],
        },
      }),
      "AGENT_PACK_PROVIDER_MISSING",
    ],
    [
      "stale host",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, hostIntegration: "stale" as const },
      }),
      "AGENT_PACK_HOST_STALE",
    ],
    [
      "cancelled auth",
      (f: PreflightFacts) => ({ ...f, auth: "cancelled" as const }),
      "AGENT_PACK_AUTH_CANCELLED",
    ],
    [
      "ambiguous auth",
      (f: PreflightFacts) => ({
        ...f,
        auth: "unknown" as const,
        observationDiagnostics: {
          auth: "Read-only preflight does not authenticate providers.",
        },
      }),
      "AGENT_PACK_AUTH_UNKNOWN",
    ],
  ])(
    "reports %s with one exact pnpm recovery",
    async (_label, mutate, code) => {
      const result = await executeAgentPackCommand(
        createPreflightCommand({ inspect: async () => mutate(readyFacts()) }),
        { mode: "fake" },
        context,
      );
      const diagnostic = result.diagnostics.find(
        (entry) => entry.code === code,
      );

      expect(diagnostic).toMatchObject({
        code,
        safeToContinue: expect.any(Boolean),
        nextAction: expect.any(String),
        rerun: expect.stringMatching(/^pnpm /),
      });
      expect(diagnostic?.nextAction).not.toBe(diagnostic?.message);
      if (
        code !== "AGENT_PACK_HOST_STALE" &&
        code !== "AGENT_PACK_AUTH_CANCELLED" &&
        code !== "AGENT_PACK_AUTH_UNKNOWN"
      ) {
        expect(result.data).toMatchObject({ safeToMutate: false });
      }
    },
  );

  it.each(["offline", "unknown"] as const)(
    "passes fake mode when optional network posture is %s",
    async (network) => {
      const facts = readyFacts();
      const result = await executeAgentPackCommand(
        createPreflightCommand({
          inspect: async () => ({
            ...facts,
            network,
            ...(network === "unknown"
              ? {
                  observationDiagnostics: {
                    network: "Registry probe timed out.",
                  },
                }
              : {}),
          }),
        }),
        { mode: "fake" },
        context,
      );

      expect(result).toMatchObject({
        exitClass: "success",
        diagnostics: [],
        data: { safeToMutate: true, facts: { network } },
      });
    },
  );

  it.each([
    ["offline", "AGENT_PACK_OFFLINE"],
    ["unknown", "AGENT_PACK_NETWORK_UNKNOWN"],
  ] as const)(
    "reports %s network posture outside fake mode",
    async (network, code) => {
      const facts = readyFacts();
      const result = await executeAgentPackCommand(
        createPreflightCommand({
          inspect: async () => ({
            ...facts,
            network,
            app: { ...facts.app, providerMode: "test" },
          }),
        }),
        { mode: "test" },
        context,
      );

      expect(result).toMatchObject({
        exitClass: "findings",
        diagnostics: [{ code, safeToContinue: true }],
        data: { safeToMutate: true },
      });
    },
  );
  it("blocks when dirty state, collisions, or the Git root could not be observed", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({
        inspect: async () => ({
          ...facts,
          repository: {
            ...facts.repository,
            dirty: "unknown",
            collisions: "unknown",
            rootMatches: "unknown",
          },
          observationDiagnostics: {
            dirty: "git status timed out.",
            collisions: "Collision attribution requires git status.",
            root: "git rev-parse was unavailable.",
          },
        }),
      }),
      { mode: "fake" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "blockedMutation",
      data: { safeToMutate: false },
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "AGENT_PACK_GIT_ROOT_UNKNOWN",
      "AGENT_PACK_DIRTY_STATE_UNKNOWN",
      "AGENT_PACK_COLLISIONS_UNKNOWN",
    ]);
  });

  it("blocks a selected mode with a missing provider without exposing payloads", async () => {
    const facts = readyFacts();
    const result = await executeAgentPackCommand(
      createPreflightCommand({
        inspect: async () => ({
          ...facts,
          app: {
            ...facts.app,
            providerMode: "live",
            providers: [{ id: "llm", posture: "missing" }],
          },
        }),
      }),
      { mode: "live" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "blockedMutation",
      data: { safeToMutate: false },
      diagnostics: [
        {
          code: "AGENT_PACK_PROVIDER_MISSING",
          rerun: "pnpm maestro -- preflight --mode live",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("API_KEY");
  });

  it("rejects invalid input without invoking the probe", async () => {
    let inspected = false;
    const command = createPreflightCommand({
      inspect: async () => {
        inspected = true;
        return readyFacts();
      },
    });

    const result = await executeAgentPackCommand(
      command,
      { mode: "production" },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "invalidInvocation",
      mutationPosture: "read-only",
      diagnostics: [{ code: "AGENT_PACK_PREFLIGHT_INVALID" }],
    });
    expect(inspected).toBe(false);
  });
});
