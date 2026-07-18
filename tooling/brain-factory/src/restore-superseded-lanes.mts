import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  GLOBAL_INTEGRATION_LOCK,
  gitSha,
  integrationLockPath,
  safeAbsolutePath,
} from "./integration-recovery.js";
import { gitIsAncestor, runRtk } from "./process.js";
import {
  applySupersededLaneRestoration,
  planSupersededLaneRestoration,
} from "./superseded-lane-restoration.js";
import { validateAppliedSupersededLaneRestoration } from "./superseded-lane-restoration-receipt.js";
import type { SupersededWaveEvidence } from "./superseded-wave-evidence.js";
import { readIntegrationWaveSelection } from "./integration-wave.js";

interface Request {
  readonly apply: boolean;
  readonly integrationId: string;
  readonly priorIntegrationId?: string;
  readonly statePath?: string;
}

const request = (args: readonly string[]): Request => {
  let apply = false;
  let integrationId: string | undefined;
  let priorIntegrationId: string | undefined;
  let statePath: string | undefined;
  const valueAt = (index: number, flag: string): string => {
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`${flag} requires a value`);
    return value;
  };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--" && index === 0) continue;
    if (flag === "--apply") {
      if (apply) throw new Error("--apply may be supplied only once");
      apply = true;
      continue;
    }
    if (
      flag === "--integration-id" ||
      flag === "--prior-integration-id" ||
      flag === "--state"
    ) {
      const value = valueAt(index, flag);
      index += 1;
      if (flag === "--integration-id") {
        if (integrationId)
          throw new Error("--integration-id may be supplied only once");
        integrationId = value;
      } else if (flag === "--prior-integration-id") {
        if (priorIntegrationId) {
          throw new Error("--prior-integration-id may be supplied only once");
        }
        priorIntegrationId = value;
      } else {
        if (statePath) throw new Error("--state may be supplied only once");
        statePath = value;
      }
      continue;
    }
    throw new Error(`unknown restore-superseded-lanes argument: ${flag}`);
  }
  if (!integrationId || !/^wave-\d{6}$/.test(integrationId)) {
    throw new Error("--integration-id must be a wave-NNNNNN identity");
  }
  if (priorIntegrationId && !/^wave-\d{6}$/.test(priorIntegrationId)) {
    throw new Error("--prior-integration-id must be a wave-NNNNNN identity");
  }
  return {
    apply,
    integrationId,
    ...(priorIntegrationId ? { priorIntegrationId } : {}),
    ...(statePath ? { statePath } : {}),
  };
};

const root = process.cwd();
const parsed = request(process.argv.slice(2));
const state = safeAbsolutePath(
  resolve(parsed.statePath ?? ".fabro/state/maestro-brain"),
  "state path",
);
const runs = resolve(state, "runs");
const evidence = resolve(state, "evidence");

const waveEvidence = (integrationId: string): SupersededWaveEvidence => {
  const selectionPath = resolve(
    runs,
    `integration-${integrationId}-selection.json`,
  );
  const runRecordPath = resolve(runs, `integration-${integrationId}.json`);
  const integrationDirectory = resolve(evidence, "integration", integrationId);
  const resultPath = resolve(integrationDirectory, "integration-result.json");
  const supersessionPath = resolve(integrationDirectory, "supersession.json");
  for (const [label, path] of [
    ["run record", runRecordPath],
    ["selection", selectionPath],
    ["integration result", resultPath],
    ["supersession receipt", supersessionPath],
  ] as const) {
    if (!existsSync(path))
      throw new Error(`${integrationId}: missing ${label}`);
  }
  return {
    integrationId,
    integrationResult: JSON.parse(readFileSync(resultPath, "utf8")),
    promotionExists: existsSync(
      resolve(integrationDirectory, "promotion.json"),
    ),
    runRecordContent: readFileSync(runRecordPath, "utf8"),
    selectionContent: readFileSync(selectionPath, "utf8"),
    selectionPath,
    supersessionReceipt: JSON.parse(readFileSync(supersessionPath, "utf8")),
  };
};

const wave = waveEvidence(parsed.integrationId);
const priorWave = parsed.priorIntegrationId
  ? waveEvidence(parsed.priorIntegrationId)
  : undefined;
const { selection } = readIntegrationWaveSelection(wave.selectionContent);
const lanePaths = new Map(
  selection.selectedTasks.map((task) => {
    if (!/^S\d{2}-T\d{2}$/.test(task.taskId)) {
      throw new Error(`${task.taskId}: unsafe lane task identity`);
    }
    return [
      task.taskId,
      resolve(evidence, "lane-results", task.taskId, "lane-result.json"),
    ] as const;
  }),
);
const lanes = [...lanePaths].map(([taskId, path]) => {
  if (!existsSync(path)) throw new Error(`${taskId}: lane result is missing`);
  return { content: readFileSync(path, "utf8"), taskId };
});
const controlHead = gitSha(
  runRtk(["git", "rev-parse", "HEAD"], { quiet: true }),
  "control HEAD",
);
const isAncestor = (ancestor: string, descendant: string): boolean =>
  gitIsAncestor(ancestor, descendant, root);
const receiptPath = resolve(
  evidence,
  "integration",
  parsed.integrationId,
  "lane-restoration.json",
);

if (existsSync(receiptPath)) {
  const receipt = validateAppliedSupersededLaneRestoration({
    currentControlHead: controlHead,
    isAncestor,
    lanes,
    receipt: JSON.parse(readFileSync(receiptPath, "utf8")),
    wave,
  });
  console.log(JSON.stringify({ action: "already-applied", receipt }, null, 2));
} else {
  const plan = planSupersededLaneRestoration({
    currentControlHead: controlHead,
    isAncestor,
    lanes,
    ...(priorWave ? { priorWave } : {}),
    wave,
  });
  if (!parsed.apply) {
    console.log(JSON.stringify({ action: "dry-run", ...plan }, null, 2));
  } else {
    const gitCommonDirectory = safeAbsolutePath(
      resolve(
        root,
        runRtk(["git", "rev-parse", "--git-common-dir"], { quiet: true }),
      ),
      "Git common directory",
    );
    const release = acquireIntegrationOwnership({
      lockPath: integrationLockPath(
        gitCommonDirectory,
        GLOBAL_INTEGRATION_LOCK,
      ),
      owner: {
        action: "restore-superseded-lanes",
        at: new Date().toISOString(),
        controlHead,
        integrationId: parsed.integrationId,
        pid: process.pid,
      },
    });
    try {
      const action = applySupersededLaneRestoration({
        lanePaths,
        plan,
        receiptPath,
      });
      console.log(JSON.stringify({ action, receipt: plan.receipt }, null, 2));
    } finally {
      release();
    }
  }
}
