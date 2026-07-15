import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isIntegrationOwnedGeneratedFile } from "../src/lane-ownership.js";
import {
  buildManifest,
  PLAN_RELATIVE,
  parseTaskPacketAuditRows,
  REPO_ROOT,
  readyWidth,
  validateManifest,
} from "../src/manifest.js";

describe("Maestro Brain execution manifest", () => {
  it("preserves every audited task and classification", () => {
    const manifest = buildManifest();
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.tasks).toHaveLength(56);
    expect(
      Object.fromEntries(
        ["template-gap", "pattern-instance", "fixture-to-real"].map((kind) => [
          kind,
          manifest.tasks.filter((task) => task.classification === kind).length,
        ]),
      ),
    ).toEqual({
      "fixture-to-real": 2,
      "pattern-instance": 7,
      "template-gap": 47,
    });
  });

  it("keeps every focused verification packet executable", () => {
    const plan = readFileSync(resolve(REPO_ROOT, PLAN_RELATIVE), "utf8");
    const shorthand = [
      "accessibility smoke",
      "accessibility test",
      "all exact release commands",
      "codegen/manifest",
      "generator/codegen/manifest",
      "integration fake tests",
      "property/concurrency tests",
      "schema/property tests",
      "targeted web tests",
    ];
    for (const match of plan.matchAll(
      /^### (S\d{2}-T\d{2}) — [^\n]+\n([\s\S]*?)(?=^### S\d{2}-T\d{2} — |^---$)/gm,
    )) {
      const taskId = match[1];
      const body = match[2] ?? "";
      const focused = body.match(
        /- \*\*Focused verification:\*\*([\s\S]*?)(?=\n- \*\*)/,
      )?.[1];
      expect(focused, `${taskId}: focused verification missing`).toBeDefined();
      expect(focused, `${taskId}: no exact rtk verification command`).toContain(
        "`rtk ",
      );
      for (const phrase of shorthand) {
        expect(
          focused?.toLowerCase(),
          `${taskId}: shorthand ${phrase}`,
        ).not.toContain(phrase);
      }
      expect(
        focused,
        `${taskId}: mutating generated-file command must use the transient helper`,
      ).not.toMatch(
        /`rtk pnpm (?:(?:--dir packages\/convex )?(?:confect:codegen|check:convex)|confect:manifest)(?:[ `])/,
      );
    }
  });

  it("exposes a real contract-first parallel frontier", () => {
    const manifest = buildManifest();
    expect(readyWidth(manifest)).toBeGreaterThanOrEqual(6);
    expect(
      manifest.tasks
        .filter((task) => task.codeStartAfter.length === 0)
        .map((task) => task.taskId),
    ).toEqual(
      expect.arrayContaining([
        "S01-T01",
        "S02-T01",
        "S03-T01",
        "S08-T01",
        "S09-T01",
      ]),
    );
  });

  it("reserves every generated output path for integration", () => {
    const manifest = buildManifest();
    expect(
      manifest.tasks.every(
        (task) =>
          !task.fileLocks.includes("@generated-confect") &&
          task.fileLocks.every(
            (file) =>
              !file.includes("/_generated/") &&
              !isIntegrationOwnedGeneratedFile(file),
          ),
      ),
    ).toBe(true);
    expect(
      manifest.tasks.some((task) => task.fileLocks.includes("@environment")),
    ).toBe(true);
    expect(
      readFileSync(resolve(REPO_ROOT, PLAN_RELATIVE), "utf8"),
    ).not.toContain("@generated-confect");
  });

  it("runs generated checks once and documents the sole zero-delta check", () => {
    const plan = readFileSync(resolve(REPO_ROOT, PLAN_RELATIVE), "utf8");
    const helperTests = [
      ...plan.matchAll(
        /^### (S\d{2}-T\d{2})[^\n]*\n([\s\S]*?)(?=^### S\d{2}-T\d{2}|^---$)/gm,
      ),
    ].flatMap((match) =>
      match[2]?.includes("brain:factory:check-confect-codegen -- --test")
        ? [match[1]]
        : [],
    );
    expect(helperTests).toEqual(["S00-T04"]);
    expect(plan.match(/`rtk pnpm check:confect-manifest`/g)).toHaveLength(1);
    expect(plan).toMatch(
      /the\s+Confect manifest check is a zero-delta assertion because this\s+task consumes/,
    );
  });

  it("serializes migrations behind deployment isolation", () => {
    const manifest = buildManifest();
    const sourceContract = manifest.tasks.find(
      (task) => task.taskId === "S00-T02",
    );
    const isolation = manifest.tasks.find((task) => task.taskId === "S00-T03");
    const migrations = manifest.tasks.find((task) => task.taskId === "S00-T04");
    expect(sourceContract?.kind).toBe("product");
    expect(sourceContract?.fileLocks).toEqual(
      expect.arrayContaining([
        "@dependencies",
        "package.json",
        "pnpm-workspace.yaml",
      ]),
    );
    expect(isolation?.fileLocks).toEqual(
      expect.arrayContaining([
        ".buildkite/pipeline.yml",
        "tooling/quality/check-config-drift.test.mts",
        "tooling/quality/src/check-definitions.mts",
      ]),
    );
    expect(migrations?.codeStartAfter).toEqual(["S00-T03"]);
    expect(migrations?.estimatedSourceLines).toBe(780);
    expect(migrations?.sourceSliceBudget).toBe(300);
    expect(migrations?.fileLocks).toContain(
      "packages/convex/confect/internal/migrations.ts",
    );
    expect(migrations?.fileLocks).not.toContain(
      "packages/convex/convex/migrations.ts",
    );
    expect(migrations?.fileLocks).toContain(
      "packages/convex/confect/tables/migrationRuns.ts",
    );
    const plan = readFileSync(resolve(REPO_ROOT, PLAN_RELATIVE), "utf8");
    const packet = plan.slice(
      plan.indexOf("### S00-T04"),
      plan.indexOf("### S01-T01"),
    );
    const normalizedPacket = packet.replace(/\s+/g, " ");
    for (const required of [
      "real generated",
      "`components.migrations`",
      "FunctionSpec.convexInternalMutation",
      "FunctionImpl.make",
      "generated Confect refs",
      "explicit `null` initial cursor",
      "dry-run rollback",
      "lease/fence generation",
      "one stable release-parent ID",
      "`failure_checkpoint`",
      "`release_parent`",
      "nullable with explicit `unavailable` provenance",
      "post-component/pre-settlement crash",
      "jobs/workpool",
      "four commits",
    ]) {
      expect(normalizedPacket, `S00-T04 missing ${required}`).toContain(
        required,
      );
    }
    const atFourSlices = {
      ...manifest,
      tasks: manifest.tasks.map((task) =>
        task.taskId === "S00-T04"
          ? { ...task, estimatedSourceLines: 1_200 }
          : task,
      ),
    };
    expect(validateManifest(atFourSlices)).not.toContain(
      "S00-T04: invalid source-line estimate 1200",
    );
    expect(
      validateManifest({
        ...atFourSlices,
        tasks: atFourSlices.tasks.map((task) =>
          task.taskId === "S00-T04"
            ? { ...task, estimatedSourceLines: 1_201 }
            : task,
        ),
      }),
    ).toContain("S00-T04: invalid source-line estimate 1201");
  });

  it("keeps durable identity and provider work behind foundation gates", () => {
    const manifest = buildManifest();
    const stableIdentity = manifest.tasks.find(
      (task) => task.taskId === "S01-T02",
    );
    const providerSetup = manifest.tasks.find(
      (task) => task.taskId === "S04-T01",
    );
    expect(stableIdentity?.codeStartAfter).toEqual(["S00-T04", "S01-T01"]);
    expect(providerSetup?.codeStartAfter).toEqual(["S00-T03", "S01-T02"]);
  });

  it("keeps code-start edges narrower than S13 acceptance", () => {
    const manifest = buildManifest();
    const semanticEvals = manifest.tasks.find(
      (task) => task.taskId === "S13-T01",
    );
    const capacity = manifest.tasks.find((task) => task.taskId === "S13-T02");
    const operations = manifest.tasks.find((task) => task.taskId === "S13-T03");
    expect(semanticEvals?.acceptanceAfter).toBe("S10, S11, S12 complete");
    expect(semanticEvals?.codeStartAfter).toEqual([]);
    expect(capacity?.acceptanceAfter).toBe("S13-T01, S06");
    expect(capacity?.codeStartAfter).toEqual(["S13-T01", "S06-T02"]);
    expect(operations?.acceptanceAfter).toBe("S13-T02");
    expect(operations?.codeStartAfter).toEqual(["S06-T02", "S08-T01"]);
    expect(
      manifest.tasks
        .filter((task) => task.taskId.startsWith("S13-"))
        .every((task) => task.tranche === "X3-convergence"),
    ).toBe(true);
  });

  it("gives lifecycle adoption work exact task-local locks", () => {
    const manifest = buildManifest();
    const lifecycleTasks = [
      "S02-T01",
      "S04-T02",
      "S04-T04",
      "S05-T01",
      "S05-T03",
      "S05-T04",
      "S06-T02",
      "S07-T01",
      "S07-T02",
      "S08-T01",
      "S08-T03",
      "S08-T04",
      "S09-T01",
      "S09-T02",
      "S09-T03",
      "S09-T04",
      "S10-T01",
      "S10-T02",
      "S11-T01",
      "S12-T02",
    ];
    const taskById = new Map(manifest.tasks.map((task) => [task.taskId, task]));
    for (const taskId of lifecycleTasks) {
      const task = taskById.get(taskId);
      expect(task?.fileLocks).toContain(
        `docs/product/maestro-brain-lifecycle-adoption/${taskId}.md`,
      );
      expect(task?.fileLocks).not.toContain(
        "docs/product/maestro-brain-lifecycle-adoption.md",
      );
    }
    expect(
      manifest.tasks.filter((task) =>
        task.fileLocks.includes(
          "docs/product/maestro-brain-lifecycle-adoption.md",
        ),
      ),
    ).toEqual([]);
  });

  it("uses only package-relevant profiles for the next frontier", () => {
    const manifest = buildManifest();
    const deployment = manifest.tasks.find((task) => task.taskId === "S00-T03");
    const generator = manifest.tasks.find((task) => task.taskId === "S08-T02");
    expect(deployment?.gateProfiles).toEqual(["release", "tooling"]);
    expect(generator?.gateProfiles).toEqual(["generators"]);
    expect(generator?.fileLocks).not.toContain("@dependencies");
  });

  it("binds completed packet audits and rejects unsafe ready pseudo-locks", () => {
    const manifest = buildManifest();
    expect(
      manifest.tasks.every((task) => task.fileInventoryStatus === "ready"),
    ).toBe(true);
    const unsafe = manifest.tasks.map((task) =>
      task.taskId === "S00-T03"
        ? {
            ...task,
            fileInventoryIssues: ["settings.test.ts: basename"],
          }
        : task,
    );
    expect(validateManifest({ ...manifest, tasks: unsafe })).toContain(
      "S00-T03: ready file inventory is unsafe: settings.test.ts: basename",
    );
  });

  it("rejects duplicate, unknown, missing, and misclassified audit rows", () => {
    const expected = new Map([
      ["S00-T01", "template-gap" as const],
      ["S00-T02", "pattern-instance" as const],
    ]);
    const heading = "### Task-packet audit\n";
    expect(
      parseTaskPacketAuditRows(
        `${heading}| S00-T01 | template-gap | ready | S00-T02 | pattern-instance | open:F |`,
        expected,
      ),
    ).toEqual(
      new Map([
        ["S00-T01", "ready"],
        ["S00-T02", "open:F"],
      ]),
    );
    expect(() =>
      parseTaskPacketAuditRows(
        `${heading}| S00-T01 | template-gap | ready | S00-T01 | template-gap | ready |`,
        expected,
      ),
    ).toThrow("duplicate task-packet audit row");
    expect(() =>
      parseTaskPacketAuditRows(
        `${heading}| S00-T01 | template-gap | ready | S00-T03 | template-gap | ready |`,
        expected,
      ),
    ).toThrow("S00-T03: unknown task-packet audit row");
    expect(() =>
      parseTaskPacketAuditRows(
        `${heading}| S00-T01 | fixture-to-real | ready | S00-T02 | pattern-instance | open:F |`,
        expected,
      ),
    ).toThrow(
      "audit classification fixture-to-real does not match template-gap",
    );
    expect(() =>
      parseTaskPacketAuditRows(
        `${heading}| S00-T01 | template-gap | ready | S00-T02 | pattern-instance | open:F |`,
        new Map([...expected, ["S00-T03", "template-gap" as const] as const]),
      ),
    ).toThrow("S00-T03: missing task-packet audit row");
  });
});
