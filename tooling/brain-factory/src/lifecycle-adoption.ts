import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const RECORD_ROOT = "docs/product/maestro-brain-lifecycle-adoption/";
const COMPLETION_STATES = new Set(["lane_green", "integrated", "accepted"]);
const STUB_MARKERS = ["**State:** task-owned stub", "Replace this stub with"];
const REQUIRED_SECTIONS = [
  "## Durable resources",
  "## Lifecycle behavior",
  "## Compatibility and rollback",
  "## Focused proof",
];

export interface LifecycleAdoptionTask {
  readonly fileLocks: readonly string[];
  readonly taskId: string;
}

export const lifecycleAdoptionRecordPath = (
  task: LifecycleAdoptionTask,
): string | undefined =>
  task.fileLocks.find(
    (file) =>
      file.startsWith(RECORD_ROOT) &&
      file === `${RECORD_ROOT}${task.taskId}.md`,
  );

export const lifecycleAdoptionRecordIssues = (input: {
  readonly root: string;
  readonly state: string;
  readonly task: LifecycleAdoptionTask;
}): readonly string[] => {
  if (!COMPLETION_STATES.has(input.state)) return [];

  const recordPath = lifecycleAdoptionRecordPath(input.task);
  if (!recordPath) return [];

  const absolutePath = resolve(input.root, recordPath);
  if (!existsSync(absolutePath)) {
    return [
      `${input.task.taskId}: missing lifecycle adoption record ${recordPath}`,
    ];
  }

  const content = readFileSync(absolutePath, "utf8");
  const issues: string[] = [];
  if (!content.includes(`**Owner:** ${input.task.taskId}`)) {
    issues.push(
      `${input.task.taskId}: lifecycle adoption record has the wrong owner`,
    );
  }
  if (STUB_MARKERS.some((marker) => content.includes(marker))) {
    issues.push(
      `${input.task.taskId}: lifecycle adoption record remains a task-owned stub`,
    );
  }
  const missingSections = REQUIRED_SECTIONS.filter(
    (section) => !content.includes(section),
  );
  if (missingSections.length > 0) {
    issues.push(
      `${input.task.taskId}: lifecycle adoption record lacks required sections: ${missingSections.join(
        ", ",
      )}`,
    );
  }
  return issues;
};
