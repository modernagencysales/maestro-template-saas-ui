import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  fabroRunId,
  GLOBAL_INTEGRATION_LOCK,
  gitSha,
  integrationLockPath,
  safeAbsolutePath,
} from "./integration-recovery.js";
import { record, string } from "./integration-check-support.js";
import { validateIntegrationResult } from "./integration-result-check.mjs";
import { proveIntegrationGeneratedOutput } from "./integration-generated-proof.js";
import {
  type IntegrationWaveSelection,
  validateIntegrationWaveSelection,
} from "./integration-wave.js";
import { runRtk } from "./process.js";
import {
  promotionAction,
  verifyPassedWaveRunInspection,
} from "./integration-wave-launch.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const integrationId = valueAfter("--integration-id");
if (!integrationId || !/^wave-\d{6}$/.test(integrationId)) {
  throw new Error(
    "usage: brain:factory:promote-wave -- --integration-id wave-NNNNNN",
  );
}

const root = process.cwd();
const state = safeAbsolutePath(
  resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain"),
  "state path",
);
const evidence = resolve(state, "evidence");
const runRecordPath = resolve(
  state,
  "runs",
  `integration-${integrationId}.json`,
);
const resultDirectory = resolve(evidence, "integration", integrationId);
const resultPath = resolve(resultDirectory, "integration-result.json");
const promotionPath = resolve(resultDirectory, "promotion.json");
if (!existsSync(runRecordPath) || !existsSync(resultPath)) {
  throw new Error(`${integrationId}: missing run or passed-result evidence`);
}
const runRecord = record(
  JSON.parse(readFileSync(runRecordPath, "utf8")),
  "wave run record",
);
if (
  runRecord.schemaVersion !== "maestro-brain-integration-wave-run/v2" ||
  runRecord.integrationId !== integrationId
) {
  throw new Error(`${integrationId}: wave run record mismatch`);
}
const selectionPath = safeAbsolutePath(
  runRecord.selectionPath,
  "wave selection path",
);
const selection = record(
  JSON.parse(readFileSync(selectionPath, "utf8")),
  "wave selection",
) as unknown as IntegrationWaveSelection;
validateIntegrationWaveSelection(selection);
const result = record(
  JSON.parse(readFileSync(resultPath, "utf8")),
  "wave result",
);
const baseSha = gitSha(result.baseSha, "wave result base");
const headSha = gitSha(result.headSha, "wave result head");
const workdir = safeAbsolutePath(
  result.integrationWorkdir,
  "wave integration workdir",
);
if (
  result.schemaVersion !== "maestro-brain-integration-result/v2" ||
  result.integrationId !== integrationId ||
  safeAbsolutePath(runRecord.workdir, "recorded wave workdir") !== workdir ||
  runRecord.branch !== `fabro/brain-${integrationId}` ||
  selection.baseSha !== baseSha ||
  JSON.stringify(runRecord.selection) !== JSON.stringify(selection) ||
  selection.selectionSha256 !== result.selectionSha256 ||
  string(runRecord.selectionSha256, "run selection hash") !==
    selection.selectionSha256
) {
  throw new Error(`${integrationId}: wave result selection mismatch`);
}
const gitCommonDirectory = safeAbsolutePath(
  resolve(
    root,
    runRtk(["git", "rev-parse", "--git-common-dir"], { quiet: true }),
  ),
  "Git common directory",
);
const releaseOwnership = acquireIntegrationOwnership({
  lockPath: integrationLockPath(gitCommonDirectory, GLOBAL_INTEGRATION_LOCK),
  owner: {
    action: "promote-integration-wave-v2",
    at: new Date().toISOString(),
    integrationId,
    pid: process.pid,
  },
});

try {
  const runId = fabroRunId(runRecord.runId, "wave run ID");
  const attempt = Number(runRecord.attempt);
  const activeMode =
    runRecord.activeMode === "recover" ? "recover" : "integrate";
  const reservationToken = string(
    runRecord.reservationToken,
    "wave reservation token",
  );
  if (
    runRecord.status !== "launched" ||
    !new Set(["integrate", "recover"]).has(String(runRecord.activeMode)) ||
    !Number.isInteger(attempt) ||
    attempt < 1
  ) {
    throw new Error(`${integrationId}: wave run is not promotable`);
  }
  verifyPassedWaveRunInspection(
    JSON.parse(
      runRtk(["fabro", "inspect", runId, "--json", "--quiet"], {
        quiet: true,
      }),
    ),
    {
      attempt,
      baseSha,
      integrationId,
      mode: activeMode,
      reservationToken,
      runId,
      selectionPath,
      selectionSha256: selection.selectionSha256,
      workdir,
    },
  );
  const branchHead = gitSha(
    runRtk(["git", "rev-parse", `refs/heads/fabro/brain-${integrationId}`], {
      quiet: true,
    }),
    "wave branch head",
  );
  if (branchHead !== headSha)
    throw new Error("wave branch and result head differ");
  validateIntegrationResult({
    controlRoot: root,
    evidenceDirectory: evidence,
    expectedWorkdir: workdir,
    integrationId,
    selectionPath,
  });
  const generatedFiles = (result.generatedFiles as string[]) ?? [];
  const laneFiles = selection.selectedTasks.flatMap(
    (task) => task.changedFiles,
  );
  if (
    generatedFiles.length > 0 ||
    laneFiles.some(
      (file) =>
        file.startsWith("packages/convex/confect/") ||
        file.startsWith("apps/web/src/routes/") ||
        file.startsWith("tooling/confect-manifest/"),
    )
  ) {
    proveIntegrationGeneratedOutput({
      baseSha,
      generatedFiles,
      headSha,
      root,
    });
  }
  const trackedStatus = runRtk(
    ["proxy", "git", "status", "--porcelain", "--untracked-files=no"],
    { quiet: true },
  );
  if (trackedStatus !== "")
    throw new Error("control worktree has tracked changes");
  const controlHead = gitSha(
    runRtk(["git", "rev-parse", "HEAD"], { quiet: true }),
    "control HEAD",
  );
  if (existsSync(promotionPath)) {
    const promotion = record(
      JSON.parse(readFileSync(promotionPath, "utf8")),
      "wave promotion",
    );
    if (
      promotion.schemaVersion !==
        "maestro-brain-integration-wave-promotion/v2" ||
      promotion.status !== "promoted" ||
      promotion.integrationId !== integrationId ||
      promotion.baseSha !== baseSha ||
      promotion.headSha !== headSha ||
      controlHead !== headSha
    ) {
      throw new Error(`${integrationId}: promotion receipt drift`);
    }
    console.log(`${integrationId}: promotion already recorded at ${headSha}`);
  } else {
    const action = promotionAction(controlHead, baseSha, headSha);
    if (action === "fast-forward") {
      runRtk(["git", "merge", "--ff-only", headSha]);
    }
    const promotedHead = gitSha(
      runRtk(["git", "rev-parse", "HEAD"], { quiet: true }),
      "promoted control HEAD",
    );
    if (promotedHead !== headSha)
      throw new Error("fast-forward promotion head mismatch");
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(
      promotionPath,
      `${JSON.stringify(
        {
          at: new Date().toISOString(),
          baseSha,
          headSha,
          integrationId,
          schemaVersion: "maestro-brain-integration-wave-promotion/v2",
          selectionSha256: selection.selectionSha256,
          status: "promoted",
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
    console.log(`${integrationId}: fast-forward promoted ${headSha}`);
  }
} finally {
  releaseOwnership();
}
