import {
  advanceBuildPack,
  createBuildPackRun,
  type BuildPackRun,
  type CompleteBuildPack,
} from "@maestro-template/app-idea-evaluator";

import type { StoredEvaluation } from "../intake/evaluation-adapter";
import { compileFakeBuildPack } from "./build-pack-generator";

export type StoredBuildPack = {
  readonly run: BuildPackRun;
  readonly pack?: CompleteBuildPack;
};

export const startBuildPackGeneration = (input: {
  readonly evaluation: StoredEvaluation;
  readonly entitlementStatus: "active" | "revoked" | "missing";
}): StoredBuildPack => ({
  run: createBuildPackRun({
    packId: `pack_${input.evaluation.id}`,
    reportId: input.evaluation.id,
    reportVersion: 1,
    entitlementStatus: input.entitlementStatus,
  }),
});

export const completeFakeBuildPack = (
  stored: StoredBuildPack,
  evaluation: StoredEvaluation,
): StoredBuildPack => {
  let run = stored.run;
  while (run.status === "running") {
    run = advanceBuildPack(
      run,
      `Completed ${run.stages.find(({ status }) => status === "running")?.name ?? "stage"}`,
    );
  }
  return { run, pack: compileFakeBuildPack(evaluation) };
};

const key = (packId: string): string =>
  `maestro.idea-funnel.build-pack.${packId}`;

export const saveBuildPack = (stored: StoredBuildPack): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key(stored.run.packId), JSON.stringify(stored));
  }
};

export const loadBuildPack = (packId: string): StoredBuildPack | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key(packId));
    return value ? (JSON.parse(value) as StoredBuildPack) : null;
  } catch {
    return null;
  }
};
