import { describe, expect, it } from "vitest";
import { executeAgentPackCommand } from "./contracts.js";
import {
  createPreflightCommand,
  fingerprintPreflight,
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
    node: { current: "22.12.0", required: "22.12.0", supported: true },
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
    recipes: "Justfile",
    documentation: "docs/template",
  },
  claimLevels: ["fake", "local", "dev", "preview", "staging", "production"],
});

describe("agent-pack preflight", () => {
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
        worksNow: "What works now: the app uses sample data saved locally.",
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
      "offline",
      (f: PreflightFacts) => ({ ...f, network: "offline" as const }),
      "AGENT_PACK_OFFLINE",
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
      "dirty overlap",
      (f: PreflightFacts) => ({
        ...f,
        repository: { ...f.repository, dirty: true, collisions: ["apps/web"] },
      }),
      "AGENT_PACK_DIRTY_OVERLAP",
    ],
    [
      "incompatible versions",
      (f: PreflightFacts) => ({ ...f, versionsCompatible: false }),
      "AGENT_PACK_VERSION_INCOMPATIBLE",
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
        code !== "AGENT_PACK_OFFLINE" &&
        code !== "AGENT_PACK_HOST_STALE" &&
        code !== "AGENT_PACK_AUTH_CANCELLED"
      ) {
        expect(result.data).toMatchObject({ safeToMutate: false });
      }
    },
  );

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
