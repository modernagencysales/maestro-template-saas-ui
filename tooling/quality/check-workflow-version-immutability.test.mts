import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildAuthoritativeSourceClosure } from "../generators/src/workflow-release-commands";

import {
  buildResolvedSourceClosure,
  checksumSourceClosure,
  checksumPublicationManifest,
  compareTrustedPublications,
  deriveActualPublicationMergeBase,
  findWorkingTreePublicationDrift,
  parsePublicationManifest,
  readTrustedPublicationManifest,
  validateComparisonBase,
  verifyPublicationManifestChecksum,
  type WorkflowPublicationManifest,
} from "./check-workflow-version-immutability.mts";

const sha = (digit: string) => digit.repeat(64);

const manifest = (): WorkflowPublicationManifest => {
  const sourceClosure = {
    roots: ["runner.ts"],
    modules: [{ path: "runner.ts", checksum: sha("5") }],
  };
  const unsigned = {
    schemaVersion: 1 as const,
    entries: [
      {
        kind: "workflow" as const,
        logicalId: "workflow.fixture.publication",
        version: 1,
        lifecycle: "published" as const,
        isolatedFixture: true,
        fingerprint: {
          graphHash: sha("1"),
          runnerRef: "workflowRunners/fixture/v1:run",
          kickoffProfiles: "eager-first-poll,queued",
          capabilityBindings: "capability.fixture.echo@v1",
          completionRef: "workflowRunners/fixture/v1:onComplete",
          runtimeVersion: "maestro-workflow-runtime.v2",
          sourceClosure: sha("2"),
          stableStepNames: "start.v2,echo.v2,receipt.v2",
          validators: "fixture.v1.args->fixture.v1.return",
          events: "event.fixture.approval.v1",
          options: "retry=v1;inline=independent;schedule=none",
          dependencyManifest: sha("3"),
          interpreter: sha("4"),
        },
        sourceClosure: {
          ...sourceClosure,
          checksum: checksumSourceClosure(sourceClosure),
        },
        artifacts: [
          {
            class: "runner" as const,
            path: "runner.ts",
            checksum: sha("5"),
          },
        ],
      },
    ],
  };
  return {
    ...unsigned,
    manifestChecksum: checksumPublicationManifest(unsigned),
  };
};

describe("workflow publication immutability gate", () => {
  it("hashes deterministic resolved-import closure including transitive modules", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-closure-"));
    mkdirSync(join(root, "runtime"), { recursive: true });
    writeFileSync(
      join(root, "runner.ts"),
      'import { run } from "./runtime/interpreter.js";\nexport { run };\n',
    );
    writeFileSync(
      join(root, "runtime/interpreter.ts"),
      'import { invoke } from "./operation";\nexport const run = invoke;\n',
    );
    writeFileSync(
      join(root, "runtime/operation.ts"),
      'export const invoke = () => "v1";\n',
    );

    const first = buildResolvedSourceClosure(root, ["runner.ts"]);
    expect(first.modules.map(({ path }) => path)).toEqual([
      "runner.ts",
      "runtime/interpreter.ts",
      "runtime/operation.ts",
    ]);
    writeFileSync(
      join(root, "runtime/operation.ts"),
      'export const invoke = () => "v2";\n',
    );
    expect(buildResolvedSourceClosure(root, ["runner.ts"]).checksum).not.toBe(
      first.checksum,
    );
  });

  it("rejects unresolved relative imports rather than hashing path names", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-closure-"));
    writeFileSync(join(root, "runner.ts"), 'import "./missing";\n');
    expect(() => buildResolvedSourceClosure(root, ["runner.ts"])).toThrow(
      /unresolved import/i,
    );
  });

  it("uses syntax nodes instead of comments or string-shaped import text", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-closure-ast-"));
    mkdirSync(join(root, "runtime"), { recursive: true });
    writeFileSync(
      join(root, "runner.ts"),
      [
        '// import "./runtime/comment-only";',
        "const prose = \"export * from './runtime/string-only'\";",
        'export { run } from "./runtime/reexport";',
        'export * from "./runtime/export-all";',
        'export const load = () => import("./runtime/dynamic");',
        "void prose;",
      ].join("\n"),
    );
    writeFileSync(join(root, "runtime/reexport.ts"), "export const run = 1;\n");
    writeFileSync(
      join(root, "runtime/export-all.ts"),
      "export const all = 1;\n",
    );
    writeFileSync(
      join(root, "runtime/dynamic.ts"),
      "export const dynamic = 1;\n",
    );

    expect(
      buildResolvedSourceClosure(root, ["runner.ts"]).modules.map(
        ({ path }) => path,
      ),
    ).toEqual([
      "runner.ts",
      "runtime/dynamic.ts",
      "runtime/export-all.ts",
      "runtime/reexport.ts",
    ]);
  });

  it("fails closed on a non-literal dynamic relative import", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-closure-ast-"));
    writeFileSync(
      join(root, "runner.ts"),
      'const target = "./runtime/hidden";\nexport const load = () => import(target);\n',
    );
    expect(() => buildResolvedSourceClosure(root, ["runner.ts"])).toThrow(
      /non-literal dynamic import/i,
    );
  });

  it("authenticates executable generated modules alongside declarations", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-generated-api-"));
    mkdirSync(join(root, "_generated"), { recursive: true });
    writeFileSync(
      join(root, "runner.ts"),
      'import { api } from "./_generated/api";\nexport const ref = api;\n',
    );
    writeFileSync(join(root, "_generated/api.d.ts"), "export const api: {};\n");
    writeFileSync(join(root, "_generated/api.js"), "export const api = {};\n");

    const checked = buildResolvedSourceClosure(root, ["runner.ts"]);
    const generated = buildAuthoritativeSourceClosure(root, ["runner.ts"]);
    expect(checked).toEqual(generated);
    expect(checked.modules.map(({ path }) => path)).toEqual([
      "_generated/api.d.ts",
      "_generated/api.js",
      "runner.ts",
    ]);

    writeFileSync(
      join(root, "_generated/api.js"),
      "export const api = { changed: true };\n",
    );
    const drifted = buildResolvedSourceClosure(root, ["runner.ts"]);
    expect(drifted.checksum).not.toBe(checked.checksum);
    expect(drifted).toEqual(
      buildAuthoritativeSourceClosure(root, ["runner.ts"]),
    );
  });

  it("rejects a misleading caller base and mutable trust-ref content", () => {
    expect(() => validateComparisonBase("caller-base", "actual-base")).toThrow(
      /actual merge base/i,
    );
    const trusted = manifest();
    expect(verifyPublicationManifestChecksum(trusted)).toEqual([]);
    expect(() =>
      parsePublicationManifest(
        JSON.stringify({
          ...trusted,
          trustedComparisonRef: "refs/heads/attacker-controlled",
        }),
      ),
    ).toThrow(/unknown fields.*trustedComparisonRef/i);
  });

  it("fails closed on nonexistent or malicious canonical CI refs", () => {
    expect(() =>
      deriveActualPublicationMergeBase(() => {
        throw new Error("unknown revision");
      }, {}),
    ).toThrow(/comparison ref does not exist/i);
    expect(() =>
      deriveActualPublicationMergeBase(() => "unused", {
        CI_COMMIT_TARGET_BRANCH: "main;git reset --hard",
      }),
    ).toThrow(/invalid canonical CI comparison branch/i);
  });

  it("rejects a corrupt trusted-base manifest and narrows first publication", () => {
    const base = "a".repeat(40);
    const corruptGit = (args: readonly string[]) =>
      args[0] === "ls-tree"
        ? "docs/template/generated/workflow-publications.json"
        : "{not-json";
    expect(() =>
      readTrustedPublicationManifest(corruptGit, base, true),
    ).toThrow();

    const absentGit = (args: readonly string[]) => {
      if (args[0] !== "ls-tree") throw new Error("unexpected git command");
      return "";
    };
    expect(() =>
      readTrustedPublicationManifest(absentGit, base, false),
    ).toThrow(/allow-first-publication/i);
    expect(readTrustedPublicationManifest(absentGit, base, true)).toBeNull();
  });

  it.each([
    "graphHash",
    "runnerRef",
    "kickoffProfiles",
    "capabilityBindings",
    "completionRef",
    "runtimeVersion",
    "sourceClosure",
    "stableStepNames",
    "validators",
    "events",
    "options",
    "dependencyManifest",
    "interpreter",
  ])("fails closed on published %s drift", (field) => {
    const trusted = manifest();
    const entry = trusted.entries[0];
    if (!entry) throw new Error("missing fixture publication");
    const changed = {
      ...entry,
      fingerprint: { ...entry.fingerprint, [field]: `changed-${field}` },
    };
    const current = {
      ...trusted,
      entries: [changed],
    };
    expect(compareTrustedPublications(trusted, current)).toContain(
      `published workflow workflow.fixture.publication@v1 changed`,
    );
  });

  it("fails on edit, delete, or move and allows an additive v2 draft", () => {
    const trusted = manifest();
    const entry = trusted.entries[0];
    if (!entry) throw new Error("missing fixture publication");
    const deleted = { ...trusted, entries: [] };
    const moved = {
      ...trusted,
      entries: [{ ...entry, logicalId: "workflow.fixture.moved" }],
    };
    const draft = {
      ...trusted,
      entries: [entry, { ...entry, version: 2, lifecycle: "draft" as const }],
    };
    expect(compareTrustedPublications(trusted, deleted)[0]).toMatch(/deleted/);
    expect(compareTrustedPublications(trusted, moved)[0]).toMatch(/deleted/);
    expect(compareTrustedPublications(trusted, draft)).toEqual([]);
  });

  it("compares published artifacts to working-tree content", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-manifest-"));
    writeFileSync(join(root, "runner.ts"), "export const version = 1;\n");
    const unsigned = manifest();
    const entry = unsigned.entries[0];
    if (!entry) throw new Error("missing fixture publication");
    const closure = buildResolvedSourceClosure(root, ["runner.ts"]);
    const current = {
      ...unsigned,
      entries: [
        {
          ...entry,
          sourceClosure: closure,
          artifacts: [
            {
              class: "runner" as const,
              path: "runner.ts",
              checksum: closure.modules[0]?.checksum ?? "",
            },
          ],
        },
      ],
    };
    expect(findWorkingTreePublicationDrift(root, current)).toEqual([]);
    writeFileSync(join(root, "runner.ts"), "export const version = 2;\n");
    expect(findWorkingTreePublicationDrift(root, current).join("\n")).toMatch(
      /runner artifact drift/,
    );
  });

  it("rejects caller-rehashed artifacts when resolved closure bytes drift", () => {
    const root = mkdtempSync(join(tmpdir(), "maestro-workflow-authority-"));
    mkdirSync(join(root, "runtime"), { recursive: true });
    writeFileSync(
      join(root, "graph.ts"),
      'import { value } from "./runtime/value";\nexport const graph = value;\n',
    );
    writeFileSync(
      join(root, "runtime/value.ts"),
      'export const value = "v1";\n',
    );
    const closure = buildResolvedSourceClosure(root, ["graph.ts"]);
    const base = manifest();
    const entry = base.entries[0];
    if (!entry) throw new Error("missing fixture publication");
    const published = {
      ...base,
      entries: [
        {
          ...entry,
          sourceClosure: closure,
          artifacts: [
            {
              class: "graph" as const,
              path: "graph.ts",
              checksum: closure.modules[0]?.checksum ?? "",
            },
          ],
        },
      ],
    };

    writeFileSync(
      join(root, "graph.ts"),
      'import { value } from "./runtime/moved";\nexport const graph = value + " forged";\n',
    );
    writeFileSync(
      join(root, "runtime/moved.ts"),
      'export const value = "v2";\n',
    );
    const forged = buildResolvedSourceClosure(root, ["graph.ts"]);
    const callerRehashed = {
      ...published,
      entries: published.entries.map((candidate) => ({
        ...candidate,
        fingerprint: {
          ...candidate.fingerprint,
          graphHash: forged.modules[0]?.checksum ?? "",
        },
        artifacts: candidate.artifacts.map((artifact) => ({
          ...artifact,
          checksum: forged.modules[0]?.checksum ?? "",
        })),
      })),
    };
    expect(findWorkingTreePublicationDrift(root, callerRehashed)).toContain(
      "source closure drift: workflow.fixture.publication@v1",
    );
  });
});
