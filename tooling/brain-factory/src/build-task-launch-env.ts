import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";

interface BuildTaskCoordinates {
  readonly authorityRepairArchive: string;
  readonly baseSha: string;
  readonly controlRoot: string;
  readonly controlCommonDir: string;
  readonly evidence: string;
  readonly hostTestMaxLoad1m: string;
  readonly reproofRequest: string;
  readonly resumeCommits: string;
  readonly resumeBranch: string;
  readonly resumeExpectedCommit: string;
  readonly resumeProofHead: string;
  readonly resumeMode: string;
  readonly resumeSourceHead: string;
  readonly resumeTaskBase: string;
  readonly startSha: string;
  readonly taskId: string;
  readonly workdir: string;
}

export const buildTaskLaunchEnv = (
  input: BuildTaskCoordinates,
): NodeJS.ProcessEnv => {
  if (
    !isAbsolute(input.workdir) ||
    !isAbsolute(input.evidence) ||
    !isAbsolute(input.controlRoot) ||
    !isAbsolute(input.controlCommonDir)
  )
    throw new Error(
      "build task workdir, evidence, control root, and common dir must be absolute",
    );
  if (!/^S\d{2}-T\d{2}$/.test(input.taskId))
    throw new Error("build task task coordinate is invalid");
  if (!/^[0-9a-f]{40}$/.test(input.baseSha))
    throw new Error("build task base SHA is invalid");
  if (!/^[0-9a-f]{40}$/.test(input.startSha))
    throw new Error("build task start SHA is invalid");
  if (!/^\d+(?:\.\d+)?$/.test(input.hostTestMaxLoad1m))
    throw new Error("build task host load is invalid");
  return {
    ...process.env,
    BRAIN_WORKDIR: input.workdir,
    BRAIN_CONTROL_ROOT: input.controlRoot,
    BRAIN_CONTROL_COMMON_DIR: input.controlCommonDir,
    BRAIN_EVIDENCE_DIR: input.evidence,
    BRAIN_TASK_ID: input.taskId,
    BRAIN_BASE_SHA: input.baseSha,
    BRAIN_START_SHA: input.startSha,
    BRAIN_RESUME_MODE: input.resumeMode,
    BRAIN_RESUME_SOURCE_HEAD: input.resumeSourceHead,
    BRAIN_RESUME_TASK_BASE: input.resumeTaskBase,
    BRAIN_RESUME_COMMITS: input.resumeCommits,
    BRAIN_RESUME_BRANCH: input.resumeBranch,
    BRAIN_RESUME_EXPECTED_COMMIT: input.resumeExpectedCommit,
    BRAIN_RESUME_PROOF_HEAD: input.resumeProofHead,
    BRAIN_REPROOF_REQUEST: input.reproofRequest,
    BRAIN_HOST_TEST_MAX_LOAD_1M: input.hostTestMaxLoad1m,
    BRAIN_REVIEW_ATTEMPT: randomUUID(),
    BRAIN_AUTHORITY_REPAIR_ARCHIVE: input.authorityRepairArchive,
  };
};
