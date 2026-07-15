import { describe, expect, it } from "vitest";
import {
  buildManifest,
  parseTaskPacketAuditRows,
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
      "pattern-instance": 8,
      "template-gap": 46,
    });
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
        "S13-T01",
      ]),
    );
  });

  it("reserves generated output for integration and locks environment ownership", () => {
    const manifest = buildManifest();
    expect(
      manifest.tasks.every(
        (task) =>
          !task.fileLocks.includes("@generated-confect") &&
          task.fileLocks.every((file) => !file.includes("/_generated/")),
      ),
    ).toBe(true);
    expect(
      manifest.tasks.some((task) => task.fileLocks.includes("@environment")),
    ).toBe(true);
  });

  it("serializes migrations behind deployment isolation", () => {
    const manifest = buildManifest();
    const isolation = manifest.tasks.find((task) => task.taskId === "S00-T03");
    const migrations = manifest.tasks.find((task) => task.taskId === "S00-T04");
    expect(isolation?.fileLocks).toEqual(
      expect.arrayContaining([
        ".buildkite/pipeline.yml",
        "tooling/quality/check-config-drift.test.mts",
        "tooling/quality/src/check-definitions.mts",
      ]),
    );
    expect(migrations?.codeStartAfter).toEqual(["S00-T03"]);
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
