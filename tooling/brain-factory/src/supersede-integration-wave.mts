import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  acquireIntegrationOwnership,
  GLOBAL_INTEGRATION_LOCK,
  gitSha,
  integrationLockPath,
  safeAbsolutePath,
} from "./integration-recovery.js";
import {
  buildIntegrationWaveSupersessionReceipt,
  materializeImmutableWaveSupersession,
  validateExistingOwnerReworkSupersessionReplay,
  validateIntegrationWaveSupersessionReceipt,
} from "./integration-wave-supersession.js";
import { gitIsAncestor, runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const valuesAfter = (flag: string): string[] => {
  const values: string[] = [];
  for (const [index, value] of process.argv.entries()) {
    const next = process.argv[index + 1];
    if (value === flag && next !== undefined) values.push(next);
  }
  return values;
};

const root = process.cwd();
const state = safeAbsolutePath(
  resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain"),
  "state path",
);
const integrationId = valueAfter("--integration-id");
if (!integrationId || !/^wave-\d{6}$/.test(integrationId)) {
  throw new Error("--integration-id must be a wave-NNNNNN identity");
}
const reason = valueAfter("--reason");
if (!reason) throw new Error("--reason is required");
const evidenceItems = valuesAfter("--evidence");
if (evidenceItems.length === 0) {
  throw new Error("at least one --evidence item is required");
}
const ownerReworkResultSha256 = valueAfter("--owner-rework-result-sha256");
if (
  ownerReworkResultSha256 !== undefined &&
  !/^[0-9a-f]{64}$/.test(ownerReworkResultSha256)
) {
  throw new Error("--owner-rework-result-sha256 must be an exact SHA-256");
}

const controlHead = gitSha(
  runRtk(["git", "rev-parse", "HEAD"], { quiet: true }),
  "control HEAD",
);
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
    action: "supersede-integration-wave",
    at: new Date().toISOString(),
    controlHead,
    integrationId,
    pid: process.pid,
  },
});

try {
  const runs = resolve(state, "runs");
  const evidence = resolve(state, "evidence", "integration", integrationId);
  const runRecordPath = resolve(runs, `integration-${integrationId}.json`);
  const selectionPath = resolve(
    runs,
    `integration-${integrationId}-selection.json`,
  );
  const promotionPath = resolve(evidence, "promotion.json");
  const supersessionPath = resolve(evidence, "supersession.json");
  const integrationResultPath = resolve(evidence, "integration-result.json");
  if (!existsSync(runRecordPath) || !existsSync(selectionPath)) {
    throw new Error(
      `${integrationId}: durable wave record or selection is missing`,
    );
  }
  if (existsSync(promotionPath)) {
    throw new Error(`${integrationId}: promoted waves cannot be superseded`);
  }
  const runRecordContent = readFileSync(runRecordPath, "utf8");
  const selectionContent = readFileSync(selectionPath);
  const runRecord = JSON.parse(runRecordContent) as {
    runIds?: unknown;
    workdir?: unknown;
  };
  const ownerReworkResultContent = ownerReworkResultSha256
    ? readFileSync(integrationResultPath, "utf8")
    : undefined;
  if (
    ownerReworkResultContent &&
    createHash("sha256").update(ownerReworkResultContent).digest("hex") !==
      ownerReworkResultSha256
  ) {
    throw new Error(`${integrationId}: owner-rework result hash mismatch`);
  }
  const expectedOwnerReworkHeadSha = ownerReworkResultContent
    ? gitSha(
        runRtk(
          [
            "proxy",
            "git",
            "-C",
            String(runRecord.workdir ?? ""),
            "rev-parse",
            "HEAD",
          ],
          { quiet: true },
        ),
        "owner-rework worktree HEAD",
      )
    : undefined;
  if (existsSync(supersessionPath)) {
    const existing = JSON.parse(readFileSync(supersessionPath, "utf8")) as {
      evidence?: unknown;
      reason?: unknown;
    };
    const validated =
      ownerReworkResultContent && expectedOwnerReworkHeadSha
        ? validateExistingOwnerReworkSupersessionReplay({
            currentControlHead: controlHead,
            evidence: evidenceItems,
            expectedIntegrationId: integrationId,
            expectedOwnerReworkHeadSha,
            isAncestor: (ancestor, descendant) =>
              gitIsAncestor(ancestor, descendant, root),
            reason,
            receipt: existing,
            resultContent: ownerReworkResultContent,
            runRecordContent,
            selectionContent,
            selectionPath,
          })
        : validateIntegrationWaveSupersessionReceipt({
            currentControlHead: controlHead,
            expectedIntegrationId: integrationId,
            isAncestor: (ancestor, descendant) =>
              gitIsAncestor(ancestor, descendant, root),
            receipt: existing,
            runRecordContent,
            selectionContent,
            selectionPath,
          });
    if (
      !ownerReworkResultContent &&
      (validated.reason !== reason.trim() ||
        JSON.stringify(validated.evidence) !==
          JSON.stringify(
            [...new Set(evidenceItems.map((item) => item.trim()))].sort(),
          ))
    ) {
      throw new Error(
        `${integrationId}: existing immutable supersession has different reason or evidence`,
      );
    }
    console.log(JSON.stringify(validated, null, 2));
  } else {
    if (!Array.isArray(runRecord.runIds)) {
      throw new Error(`${integrationId}: durable runIds are missing`);
    }
    const runInspections = runRecord.runIds.map((runId) =>
      JSON.parse(
        runRtk(["fabro", "inspect", String(runId), "--json", "--quiet"], {
          quiet: true,
        }),
      ),
    );
    const receipt = buildIntegrationWaveSupersessionReceipt({
      controlHeadSha: controlHead,
      createdAt: new Date().toISOString(),
      evidence: evidenceItems,
      expectedIntegrationId: integrationId,
      ...(expectedOwnerReworkHeadSha ? { expectedOwnerReworkHeadSha } : {}),
      ...(ownerReworkResultContent ? { ownerReworkResultContent } : {}),
      reason,
      runInspections,
      runRecordContent,
      selectionContent,
      selectionPath,
    });
    mkdirSync(evidence, { recursive: true });
    materializeImmutableWaveSupersession(supersessionPath, receipt);
    console.log(JSON.stringify(receipt, null, 2));
  }
} finally {
  releaseOwnership();
}
