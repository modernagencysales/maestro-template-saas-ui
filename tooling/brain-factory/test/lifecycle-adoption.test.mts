import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { lifecycleAdoptionRecordIssues } from "../src/lifecycle-adoption.js";
import { buildManifest, REPO_ROOT } from "../src/manifest.js";

const temporaryDirectories: string[] = [];
const task = {
  taskId: "S02-T01",
  fileLocks: ["docs/product/maestro-brain-lifecycle-adoption/S02-T01.md"],
};

const recordFixture = (content: string): string => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-lifecycle-adoption-"));
  temporaryDirectories.push(root);
  const directory = resolve(
    root,
    "docs/product/maestro-brain-lifecycle-adoption",
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "S02-T01.md"), content);
  return root;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("task-local lifecycle adoption records", () => {
  it("keeps every already-integrated lifecycle record evidence-bearing", () => {
    const manifest = buildManifest();
    for (const taskId of ["S02-T01", "S08-T01", "S09-T01", "S11-T01"]) {
      const integratedTask = manifest.tasks.find(
        (candidate) => candidate.taskId === taskId,
      );
      expect(integratedTask).toBeDefined();
      if (!integratedTask) continue;
      expect(
        lifecycleAdoptionRecordIssues({
          root: REPO_ROOT,
          state: "integrated",
          task: integratedTask,
        }),
      ).toEqual([]);
    }
  });

  it("allows a stub only before lane completion", () => {
    const root = recordFixture(
      "# Record\n\n**Owner:** S02-T01  \n**State:** task-owned stub\n\nReplace this stub with evidence.\n",
    );

    expect(
      lifecycleAdoptionRecordIssues({ root, state: "planned", task }),
    ).toEqual([]);
    for (const state of ["lane_green", "integrated", "accepted"]) {
      expect(lifecycleAdoptionRecordIssues({ root, state, task })).toEqual(
        expect.arrayContaining([
          "S02-T01: lifecycle adoption record remains a task-owned stub",
          expect.stringContaining(
            "S02-T01: lifecycle adoption record lacks required sections",
          ),
        ]),
      );
    }
  });

  it("accepts an owned evidence-bearing completed record", () => {
    const root = recordFixture(
      "# Record\n\n**Owner:** S02-T01  \n**State:** integrated\n\n## Durable resources\n\nEvidence.\n\n## Lifecycle behavior\n\nEvidence.\n\n## Compatibility and rollback\n\nEvidence.\n\n## Focused proof\n\nEvidence.\n",
    );

    expect(
      lifecycleAdoptionRecordIssues({ root, state: "integrated", task }),
    ).toEqual([]);
  });

  it("rejects missing and cross-owned completed records", () => {
    const missingRoot = mkdtempSync(
      resolve(tmpdir(), "brain-lifecycle-adoption-missing-"),
    );
    temporaryDirectories.push(missingRoot);
    expect(
      lifecycleAdoptionRecordIssues({
        root: missingRoot,
        state: "lane_green",
        task,
      }),
    ).toEqual([
      "S02-T01: missing lifecycle adoption record docs/product/maestro-brain-lifecycle-adoption/S02-T01.md",
    ]);

    const wrongOwnerRoot = recordFixture(
      "# Record\n\n**Owner:** S03-T01  \n**State:** integrated\n",
    );
    expect(
      lifecycleAdoptionRecordIssues({
        root: wrongOwnerRoot,
        state: "accepted",
        task,
      }),
    ).toEqual(
      expect.arrayContaining([
        "S02-T01: lifecycle adoption record has the wrong owner",
        expect.stringContaining(
          "S02-T01: lifecycle adoption record lacks required sections",
        ),
      ]),
    );
  });
});
