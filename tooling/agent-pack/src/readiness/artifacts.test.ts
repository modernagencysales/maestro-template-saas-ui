import { describe, expect, it, vi } from "vitest";
import type { RepositoryContext } from "../repoContext.js";
import { loadBuildReadinessInput } from "./artifacts.js";

const repo: RepositoryContext = {
  schemaVersion: 1,
  workingDirectory: "/customer",
  sourceRoot: "/customer",
  templateRoot: "/customer",
  targetRoot: "/customer",
};
const preflight = {
  worksNow: "Fake records work now.",
  demoOnly: "Live connections are demo-only.",
  safeToStart: true,
  diagnostics: [],
  blueprint: "saas-application",
  providers: [{ id: "convex", posture: "sample" as const }],
};
const current = {
  subject: { commit: "new-commit", dirty: false },
  repositoryFingerprint: "repository_sha256:new" as const,
  environmentFingerprint: "environment_sha256:env" as const,
  providerPostureFingerprint: "providers_sha256:providers" as const,
};

function files(receipt?: unknown) {
  return new Map([
    [
      "/customer/template-instance.json",
      JSON.stringify({
        personalization: {
          name: "My App",
          firstOutcome: "Create and read a record",
          demoOnly: true,
        },
        blueprint: {
          id: "saas-application",
          workflowPosture: "optional-unavailable",
        },
        providerMode: "fake",
        providers: { convex: "fake" },
        ignoredSecret: "deploy-key-value",
      }),
    ],
    [
      "/customer/generated/blueprints/saas-application/readiness.json",
      JSON.stringify({
        schemaVersion: 1,
        surfaces: [
          { id: "workspace-membership", status: "real" },
          { id: "fake-record-crud", status: "fake" },
          { id: "local-convex-record-crud", status: "seam" },
          { id: "live-provider", status: "unavailable" },
        ],
        automation: { status: "unavailable" },
      }),
    ],
    ...(receipt === undefined
      ? []
      : [
          [
            "/customer/.maestro/verification-receipt.json",
            JSON.stringify(receipt),
          ] as const,
        ]),
  ]);
}

describe("readiness canonical artifact adapter", () => {
  it("projects only reviewed fields and evaluates the latest receipt", async () => {
    const stored = files({
      schemaVersion: 1,
      createdAt: "2026-07-25T12:00:00.000Z",
      command: { id: "verify", version: 1 },
      subject: { commit: "old-commit", dirty: false },
      fingerprints: {
        repository: "repository_sha256:old",
        environment: "environment_sha256:env",
        providerPosture: "providers_sha256:providers",
      },
      scope: { kind: "full", changedPaths: [], partial: false },
      gates: [],
    });
    const readFile = vi.fn(async (path: string) => {
      const value = stored.get(path);
      if (value === undefined)
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return value;
    });

    const result = await loadBuildReadinessInput({
      repo,
      preflight,
      current,
      readFile,
    });

    expect(result).toMatchObject({
      app: {
        name: "My App",
        firstOutcome: "Create and read a record",
        demoOnly: true,
      },
      blueprint: { id: "saas-application", workflowSelected: false },
      recipe: null,
      providerEnvironments: [
        {
          environment: "fake",
          providers: [{ id: "convex", state: "fake", evidence: [] }],
        },
        {
          environment: "local",
          providers: [{ id: "convex", state: "fake", evidence: [] }],
        },
        {
          environment: "dev",
          providers: [{ id: "convex", state: "unavailable", evidence: [] }],
        },
        {
          environment: "preview",
          providers: [{ id: "convex", state: "unavailable", evidence: [] }],
        },
        {
          environment: "staging",
          providers: [{ id: "convex", state: "unavailable", evidence: [] }],
        },
        {
          environment: "production",
          providers: [{ id: "convex", state: "unavailable", evidence: [] }],
        },
      ],
      surfaces: [
        { id: "workspace-membership", kind: "screen", status: "real" },
        { id: "fake-record-crud", kind: "data", status: "fake" },
        { id: "local-convex-record-crud", kind: "data", status: "seam" },
        { id: "live-provider", kind: "connection", status: "unverified" },
      ],
      receipt: {
        staleness: {
          stale: true,
          reasons: ["commit-changed", "repository-fingerprint-changed"],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("deploy-key-value");
  });

  it("fails closed when the required blueprint readiness artifact is absent", async () => {
    const stored = files();
    stored.delete(
      "/customer/generated/blueprints/saas-application/readiness.json",
    );
    await expect(
      loadBuildReadinessInput({
        repo,
        preflight,
        current,
        readFile: async (path) => {
          const value = stored.get(path);
          if (value === undefined) throw new Error("missing");
          return value;
        },
      }),
    ).rejects.toThrow("Blueprint readiness artifact is invalid");
  });

  it.each([
    ["full partial", { kind: "full", changedPaths: [], partial: true }],
    ["focused complete", { kind: "focused", changedPaths: [], partial: false }],
    [
      "full changed",
      { kind: "full", changedPaths: ["changed.ts"], partial: false },
    ],
  ])("rejects an invalid %s receipt scope", async (_name, scope) => {
    const stored = files({
      schemaVersion: 1,
      createdAt: "2026-07-25T12:00:00.000Z",
      command: { id: "verify", version: 1 },
      subject: { commit: "abc123", dirty: false },
      fingerprints: {
        repository: "repository_sha256:new",
        environment: "environment_sha256:env",
        providerPosture: "providers_sha256:providers",
      },
      scope,
      gates: [],
    });
    const result = await loadBuildReadinessInput({
      repo,
      preflight,
      current,
      readFile: async (path) => {
        const value = stored.get(path);
        if (value === undefined) throw new Error("missing");
        return value;
      },
    });
    expect(result.receipt).toEqual({ malformed: true });
  });

  it.each([
    ["malformed", "{not-json", { malformed: true }],
    ["missing", undefined, null],
  ])(
    "keeps a %s receipt secret-safe and unavailable",
    async (_name, raw, expected) => {
      const stored = files();
      if (raw !== undefined)
        stored.set("/customer/.maestro/verification-receipt.json", raw);
      const result = await loadBuildReadinessInput({
        repo,
        preflight,
        current,
        readFile: async (path) => {
          const value = stored.get(path);
          if (value === undefined)
            throw Object.assign(new Error("secret-value"), { code: "ENOENT" });
          return value;
        },
      });
      expect(result.receipt).toEqual(expected);
      expect(JSON.stringify(result)).not.toContain("secret-value");
    },
  );
});
