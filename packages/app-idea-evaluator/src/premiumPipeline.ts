import {
  advanceBuildPack,
  decodeCompleteBuildPack,
  failBuildPackStage,
  type BuildPackRun,
  type BuildPackStageName,
  type CompleteBuildPack,
} from "./buildPack";

export type PremiumStageInput = {
  readonly packId: string;
  readonly reportId: string;
  readonly reportVersion: number;
  readonly stage: BuildPackStageName;
  readonly completedOutputs: Readonly<
    Partial<Record<BuildPackStageName, string>>
  >;
};

export type PremiumBuildPackExecution = {
  readonly run: BuildPackRun;
  readonly pack: CompleteBuildPack | null;
};

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "Premium model stage failed.";

export async function executePremiumBuildPack({
  run: initialRun,
  runStage,
  checkpoint,
}: {
  readonly run: BuildPackRun;
  readonly runStage: (input: PremiumStageInput) => Promise<string>;
  readonly checkpoint: (run: BuildPackRun) => Promise<void>;
}): Promise<PremiumBuildPackExecution> {
  let run = initialRun;
  let pack: CompleteBuildPack | null = null;

  while (run.status === "running") {
    const current = run.stages.find(({ status }) => status === "running");
    if (!current) throw new Error("Running Build Pack has no active stage.");
    const completedOutputs = Object.fromEntries(
      run.stages.flatMap((stage) =>
        stage.status === "completed" && stage.output !== undefined
          ? [[stage.name, stage.output] as const]
          : [],
      ),
    );
    try {
      const output = await runStage({
        packId: run.packId,
        reportId: run.reportId,
        reportVersion: run.reportVersion,
        stage: current.name,
        completedOutputs,
      });
      if (current.name === "compile") {
        pack = decodeCompleteBuildPack(JSON.parse(output));
      }
      run = advanceBuildPack(run, output);
    } catch (cause) {
      run = failBuildPackStage(run, errorMessage(cause));
    }
    await checkpoint(run);
  }

  return { run, pack };
}
