import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { reconcileAcceptanceEvidence } from "./acceptance-reconciliation.js";
import {
  type BrainTaskManifest,
  MANIFEST_RELATIVE,
  validateManifest,
} from "./manifest.js";
import { gitIsAncestor, runRtk } from "./process.js";

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const workdirValue = valueAfter("--workdir");
const evidenceValue = valueAfter("--evidence");
const broadGateValue = valueAfter("--broad-gate");
if (!workdirValue || !evidenceValue || !broadGateValue) {
  throw new Error(
    "usage: brain:factory:reconcile-acceptance -- --workdir <absolute-path> " +
      "--evidence <absolute-path> --broad-gate <absolute-path> [--manifest <path>]",
  );
}
if (
  !isAbsolute(workdirValue) ||
  !isAbsolute(evidenceValue) ||
  !isAbsolute(broadGateValue)
) {
  throw new Error(
    "acceptance workdir, evidence, and broad-gate paths must be absolute",
  );
}

const workdir = realpathSync(workdirValue);
const evidenceDirectory = realpathSync(evidenceValue);
const broadGatePath = realpathSync(broadGateValue);
const manifestPath = resolve(
  workdir,
  valueAfter("--manifest") ?? MANIFEST_RELATIVE,
);
const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as BrainTaskManifest;
const manifestErrors = validateManifest(manifest);
if (manifestErrors.length > 0) {
  throw new Error(`invalid task manifest:\n${manifestErrors.join("\n")}`);
}
const controlHead = runRtk(["proxy", "git", "rev-parse", "HEAD"], {
  cwd: workdir,
  quiet: true,
});
const trackedStatus = runRtk(
  ["proxy", "git", "status", "--porcelain", "--untracked-files=no"],
  { cwd: workdir, quiet: true },
);
if (trackedStatus !== "") {
  throw new Error("acceptance worktree has tracked changes");
}

const result = reconcileAcceptanceEvidence({
  broadGatePath,
  controlHead,
  evidenceDirectory,
  isAncestor: (ancestor, descendant) =>
    gitIsAncestor(ancestor, descendant, workdir),
  manifest,
});
console.log(
  `${controlHead}: acceptance reconciled in ${result.path} (${result.contentSha256})`,
);
