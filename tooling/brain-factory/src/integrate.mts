import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hydrateWorktreeDependencies } from "./dependencies.js";
import {
  type IntegrationAttemptState,
  nextIntegrationId,
} from "./factory-state.js";
import {
  acquireIntegrationOwnership,
  integrationLockPath,
} from "./integration-recovery.js";
import { gitBranchExists, gitIsAncestor, runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const manifestTranche = valueAfter("--tranche");
if (!manifestTranche) {
  console.error("usage: brain:factory:integrate -- --tranche <id>");
  process.exit(2);
}
if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(manifestTranche)) {
  throw new Error(`invalid tranche ${manifestTranche}`);
}
const root = process.cwd();
const state = resolve(valueAfter("--state") ?? ".fabro/state/maestro-brain");
const evidence = resolve(state, "evidence");
const runs = resolve(state, "runs");
const workflow = resolve(
  ".fabro/workflows/brain-integrate-tranche/workflow.fabro",
);
const worktreeRoot = resolve(root, "..", ".maestro-brain-fabro-workdirs");
const baseSha = runRtk(["git", "rev-parse", "HEAD"], { quiet: true });
const releaseOwnership = acquireIntegrationOwnership({
  lockPath: integrationLockPath(state, manifestTranche),
  owner: {
    action: "launch-integration",
    at: new Date().toISOString(),
    manifestTranche,
    pid: process.pid,
  },
});
try {
  if (!existsSync(workflow)) throw new Error(`missing workflow ${workflow}`);
  const stateFor = (integrationId: string): IntegrationAttemptState => {
    const integrationResult = resolve(
      evidence,
      "integration",
      integrationId,
      "integration-result.json",
    );
    const runRecord = resolve(runs, `integration-${integrationId}.json`);
    const workdir = resolve(worktreeRoot, `integration-${integrationId}`);
    const branch = `fabro/brain-${integrationId.toLowerCase()}`;
    const existingBranch = gitBranchExists(branch, root);
    const result = existsSync(integrationResult)
      ? (JSON.parse(readFileSync(integrationResult, "utf8")) as {
          readonly headSha?: string;
          readonly integrationHeadSha?: string;
          readonly status?: string;
        })
      : undefined;
    const headSha = result?.headSha ?? result?.integrationHeadSha;
    return {
      existingArtifacts: [
        ...(existsSync(integrationResult)
          ? [`evidence ${integrationResult}`]
          : []),
        ...(existsSync(runRecord) ? [`run record ${runRecord}`] : []),
        ...(existsSync(workdir) ? [`worktree ${workdir}`] : []),
        ...(existingBranch ? [`branch ${branch}`] : []),
      ],
      ...(headSha !== undefined ? { headSha } : {}),
      ...(result?.status !== undefined ? { status: result.status } : {}),
    };
  };
  const integrationId = nextIntegrationId({
    controlHead: baseSha,
    isAncestor: (ancestor, descendant) =>
      gitIsAncestor(ancestor, descendant, root),
    manifestTranche,
    stateFor,
  });
  const workdir = resolve(worktreeRoot, `integration-${integrationId}`);
  const branch = `fabro/brain-${integrationId.toLowerCase()}`;
  const runRecord = resolve(runs, `integration-${integrationId}.json`);
  runRtk(["git", "worktree", "add", "-B", branch, workdir, baseSha]);
  hydrateWorktreeDependencies(root, workdir);
  const output = runRtk(
    [
      "fabro",
      "run",
      workflow,
      "--detach",
      "--json",
      "--no-upgrade-check",
      "--environment",
      "local",
      "--label",
      `tranche=${manifestTranche}`,
      "--label",
      `integration=${integrationId}`,
      "-I",
      `workdir=${workdir}`,
      "-I",
      `control_root=${root}`,
      "-I",
      `evidence_dir=${evidence}`,
      "-I",
      `tranche=${manifestTranche}`,
      "-I",
      `manifest_tranche=${manifestTranche}`,
      "-I",
      `integration_id=${integrationId}`,
      "-I",
      `base_sha=${baseSha}`,
    ],
    { quiet: true },
  );
  const parsed = JSON.parse(output) as { run_id?: string; runId?: string };
  const runId = parsed.run_id ?? parsed.runId;
  if (!runId) throw new Error(`Fabro did not return a run ID: ${output}`);
  mkdirSync(runs, { recursive: true });
  writeFileSync(
    runRecord,
    `${JSON.stringify(
      {
        baseSha,
        branch,
        integrationId,
        manifestTranche,
        runId,
        tranche: manifestTranche,
        workdir,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `${manifestTranche}: launched integration ${integrationId} as ${runId}`,
  );
} finally {
  releaseOwnership();
}
