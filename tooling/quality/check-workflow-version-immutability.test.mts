import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildResolvedSourceClosure,
  checksumPublicationManifest,
  compareTrustedPublications,
  findWorkingTreePublicationDrift,
  validateComparisonBase,
  verifyPublicationManifestChecksum,
  type WorkflowPublicationManifest,
} from "./check-workflow-version-immutability.mts";

const sha = (digit: string) => digit.repeat(64);

const manifest = (): WorkflowPublicationManifest => {
  const unsigned = {
    schemaVersion: 1 as const,
    trustedComparisonRef: "main",
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
      'import { run } from "./runtime/interpreter";\nexport { run };\n',
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

  it("rejects a misleading caller base and a rewritten manifest checksum", () => {
    expect(() => validateComparisonBase("caller-base", "actual-base")).toThrow(
      /actual merge base/i,
    );
    const trusted = manifest();
    expect(verifyPublicationManifestChecksum(trusted)).toEqual([]);
    expect(
      verifyPublicationManifestChecksum({
        ...trusted,
        trustedComparisonRef: "attacker-controlled",
      }),
    ).toContain("publication manifest checksum mismatch");
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
    expect(findWorkingTreePublicationDrift(root, current)[0]).toMatch(
      /runner artifact drift/,
    );
  });
});
