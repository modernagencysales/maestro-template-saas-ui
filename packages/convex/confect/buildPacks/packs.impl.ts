import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  PREMIUM_MODEL_POLICY,
  authorizeModelCall,
  buildPackStageNames,
  decodeCompleteBuildPack,
  executePremiumBuildPack,
  retryBuildPackStage,
  type BuildPackRun,
  type BuildPackStageName,
  type ModelUsage,
} from "@maestro-template/app-idea-evaluator";
import { createLlmGateway } from "@maestro-template/integrations";
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import databaseSchema from "../_generated/schema";
import refs from "../_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "../_generated/services";
import {
  ConfigInvalid,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";
import { loadLlmGatewayEnvConfig } from "../evaluator/providerConfig";
import { RuntimeModeConfig } from "../shared/config";
import { sha256Hex } from "../shared/sha256";
import packsGroup from "./packs.spec";
import { enqueueBuildPackRun } from "./workpool";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const premiumStageOutputTokens: Readonly<Record<BuildPackStageName, number>> = {
  normalize: 3_000,
  challenge: 4_000,
  research: 6_000,
  design: 5_000,
  specify: 8_000,
  review: 4_000,
  compile: 8_000,
  "map-to-maestro": 2_000,
};

class StageLeaseUnavailable extends Data.TaggedError("StageLeaseUnavailable")<{
  readonly message: string;
}> {}
class PremiumBuildPackRuntimeError extends Data.TaggedError(
  "PremiumBuildPackRuntimeError",
)<{ readonly message: string; readonly cause?: unknown }> {}

type PackSummary = {
  readonly packId: string;
  readonly reportId: string;
  readonly reportVersion: number;
  readonly status: BuildPackRun["status"] | "revoked";
  readonly supportId?: string | undefined;
  readonly stages: BuildPackRun["stages"];
};

const rowsToRun = (
  pack: {
    readonly packId: string;
    readonly reportId: string;
    readonly reportVersion: number;
    readonly status: BuildPackRun["status"] | "revoked";
  },
  stages: readonly {
    readonly stageName: string;
    readonly status: BuildPackRun["stages"][number]["status"];
    readonly attempts: number;
    readonly outputJson?: string | undefined;
    readonly errorCode?: string | undefined;
  }[],
): BuildPackRun => ({
  packId: pack.packId,
  reportId: pack.reportId,
  reportVersion: pack.reportVersion,
  status: pack.status === "revoked" ? "needs-support" : pack.status,
  stages: buildPackStageNames.map((name) => {
    const row = stages.find(({ stageName }) => stageName === name);
    if (!row)
      return Effect.runSync(
        Effect.die(new Error(`Missing Build Pack stage: ${name}`)),
      );
    return {
      name,
      status: row.status,
      attempts: row.attempts,
      ...(row.outputJson === undefined ? {} : { output: row.outputJson }),
      ...(row.errorCode === undefined ? {} : { error: row.errorCode }),
    };
  }),
});

const summaryFrom = (
  pack: {
    readonly packId: string;
    readonly reportId: string;
    readonly reportVersion: number;
    readonly status: BuildPackRun["status"] | "revoked";
  },
  stages: readonly {
    readonly stageName: string;
    readonly status: BuildPackRun["stages"][number]["status"];
    readonly attempts: number;
    readonly outputJson?: string | undefined;
    readonly errorCode?: string | undefined;
  }[],
): PackSummary => {
  const run = rowsToRun(pack, stages);
  return {
    packId: pack.packId,
    reportId: pack.reportId,
    reportVersion: pack.reportVersion,
    status: pack.status,
    stages: run.stages,
  };
};

const loadPackRows = (packId: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const pack = yield* reader
      .table("buildPacks")
      .index("by_pack", (q) => q.eq("packId", packId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (!pack)
      return yield* new NotFound({ resource: "buildPacks", id: packId });
    const stages = yield* reader
      .table("buildPackStages")
      .index("by_pack", (q) => q.eq("packId", packId))
      .collect()
      .pipe(Effect.orDie);
    return { pack, stages };
  });

const requirePackOwner = (packId: string, ownerAccessToken: string) =>
  Effect.gen(function* () {
    if (!packId.trim() || !ownerAccessToken.trim())
      return yield* new ValidationFailed({
        field: "credentials",
        message: "A Build Pack and owner token are required.",
      });
    const loaded = yield* loadPackRows(packId.trim());
    const reader = yield* DatabaseReader;
    const ownership = yield* reader
      .table("reportOwnerships")
      .index("by_report", (q) => q.eq("reportId", loaded.pack.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (
      !ownership ||
      ownership.ownerAccessTokenHash !== sha256Hex(ownerAccessToken.trim())
    )
      return yield* new Unauthorized();
    const entitlement = yield* reader
      .table("buildPackEntitlements")
      .index("by_report", (q) => q.eq("reportId", loaded.pack.reportId))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    return {
      ...loaded,
      active: entitlement?.status === "active",
      entitlement,
    };
  });

const startPackImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "startPack",
  ({ reportId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const normalizedReportId = reportId.trim();
      const normalizedToken = ownerAccessToken.trim();
      if (!normalizedReportId || !normalizedToken)
        return yield* new ValidationFailed({
          field: "credentials",
          message: "A report and owner token are required.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const report = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!report)
        return yield* new NotFound({
          resource: "evaluationReports",
          id: normalizedReportId,
        });
      const ownership = yield* reader
        .table("reportOwnerships")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        !ownership ||
        ownership.ownerAccessTokenHash !== sha256Hex(normalizedToken)
      )
        return yield* new Unauthorized();
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!entitlement || entitlement.status !== "active")
        return yield* new Unauthorized();
      const existing = yield* reader
        .table("buildPacks")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing) {
        const stages = yield* reader
          .table("buildPackStages")
          .index("by_pack", (q) => q.eq("packId", existing.packId))
          .collect()
          .pipe(Effect.orDie);
        return summaryFrom(existing, stages);
      }
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const packId = `pack_${sha256Hex(`${normalizedReportId}:${String(report.currentVersion)}`).slice(0, 24)}`;
      yield* writer
        .table("buildPacks")
        .insert({
          packId,
          reportId: normalizedReportId,
          reportVersion: report.currentVersion,
          status: "running",
          createdAt: now,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      for (const [index, stageName] of buildPackStageNames.entries()) {
        yield* writer
          .table("buildPackStages")
          .insert({
            packId,
            stageName,
            status: index === 0 ? "running" : "queued",
            attempts: index === 0 ? 1 : 0,
            estimatedCostCents: 0,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      yield* writer
        .table("buildPackEntitlements")
        .patch(entitlement._id, {
          generationAttempts: entitlement.generationAttempts + 1,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      yield* enqueueBuildPackRun(packId);
      return {
        packId,
        reportId: normalizedReportId,
        reportVersion: report.currentVersion,
        status: "running" as const,
        stages: buildPackStageNames.map((name, index) => ({
          name,
          status: index === 0 ? ("running" as const) : ("queued" as const),
          attempts: index === 0 ? 1 : 0,
        })),
      };
    }),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "status",
  ({ packId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const { pack, stages, active } = yield* requirePackOwner(
        packId,
        ownerAccessToken,
      );
      const summary = active
        ? summaryFrom(pack, stages)
        : { ...summaryFrom(pack, stages), status: "revoked" as const };
      if (pack.status !== "needs-support") return summary;
      const reader = yield* DatabaseReader;
      const incidents = yield* reader
        .table("supportIncidents")
        .index("by_pack", (q) => q.eq("packId", pack.packId))
        .collect()
        .pipe(Effect.orDie);
      const incident = incidents
        .filter(({ status }) => status === "needs-support")
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
      return incident
        ? { ...summary, supportId: incident.incidentId }
        : summary;
    }),
);

const getPackImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "getPack",
  ({ packId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const { pack, active } = yield* requirePackOwner(
        packId,
        ownerAccessToken,
      );
      if (!active) return yield* new Unauthorized();
      if (pack.status !== "completed" || !pack.canonicalPackJson)
        return yield* new ValidationFailed({
          field: "packId",
          message: "The Complete Build Pack is not ready yet.",
        });
      return {
        packId: pack.packId,
        reportId: pack.reportId,
        reportVersion: pack.reportVersion,
        canonicalPackJson: pack.canonicalPackJson,
      };
    }),
);

const retryFailedStageImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "retryFailedStage",
  ({ packId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const { pack, stages, active, entitlement } = yield* requirePackOwner(
        packId,
        ownerAccessToken,
      );
      if (!active || !entitlement) return yield* new Unauthorized();
      let retried: BuildPackRun;
      try {
        retried = retryBuildPackStage(rowsToRun(pack, stages));
      } catch (cause) {
        return yield* new ValidationFailed({
          field: "packId",
          message:
            cause instanceof Error ? cause.message : "Pack cannot retry.",
        });
      }
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const current = retried.stages.find(({ status }) => status === "running");
      const stageRow = stages.find(
        ({ stageName }) => stageName === current?.name,
      );
      if (!current || !stageRow)
        return yield* new ValidationFailed({
          field: "packId",
          message: "The failed checkpoint could not be found.",
        });
      yield* writer
        .table("buildPackStages")
        .patch(stageRow._id, {
          status: "running",
          attempts: current.attempts,
          errorCode: undefined,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("buildPacks")
        .patch(pack._id, { status: "running", updatedAt: now })
        .pipe(Effect.orDie);
      yield* writer
        .table("buildPackEntitlements")
        .patch(entitlement._id, {
          generationAttempts: entitlement.generationAttempts + 1,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      yield* enqueueBuildPackRun(packId);
      return summaryFrom(
        { ...pack, status: "running" },
        stages.map((stage) =>
          stage._id === stageRow._id
            ? {
                ...stage,
                status: "running" as const,
                attempts: current.attempts,
                errorCode: undefined,
              }
            : stage,
        ),
      );
    }),
);

const loadPackRunImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "loadPackRun",
  ({ packId }) =>
    Effect.gen(function* () {
      const { pack, stages } = yield* loadPackRows(packId.trim());
      const reader = yield* DatabaseReader;
      const reportVersion = yield* reader
        .table("evaluationReportVersions")
        .index("by_report_version", (q) =>
          q.eq("reportId", pack.reportId).eq("version", pack.reportVersion),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!reportVersion)
        return yield* new NotFound({
          resource: "evaluationReportVersions",
          id: `${pack.reportId}:${String(pack.reportVersion)}`,
        });
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const utcDayStart = now - (now % 86_400_000);
      const utcDayEnd = utcDayStart + 86_400_000;
      const receipts = yield* reader
        .table("modelReceipts")
        .index("by_generated_at")
        .collect()
        .pipe(Effect.orDie);
      return {
        runJson: JSON.stringify(rowsToRun(pack, stages)),
        reportJson: reportVersion.reportJson,
        currentDailySpendCents: receipts
          .filter(
            ({ generatedAt }) =>
              generatedAt >= utcDayStart && generatedAt < utcDayEnd,
          )
          .reduce((sum, receipt) => sum + receipt.estimatedCents, 0),
      };
    }),
);

const claimStageImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "claimStage",
  ({ packId, leaseId }) =>
    Effect.gen(function* () {
      if (!leaseId.trim())
        return yield* new ValidationFailed({
          field: "leaseId",
          message: "A runner lease identifier is required.",
        });
      const { pack, stages } = yield* loadPackRows(packId.trim());
      if (pack.status === "completed" || pack.status === "revoked")
        return { claimed: false };
      const reader = yield* DatabaseReader;
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_report", (q) => q.eq("reportId", pack.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (entitlement?.status !== "active") {
        const writer = yield* DatabaseWriter;
        const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
        yield* writer
          .table("buildPacks")
          .patch(pack._id, { status: "revoked", updatedAt: now })
          .pipe(Effect.orDie);
        return { claimed: false };
      }
      const stage = stages.find(({ status }) => status === "running");
      if (!stage) return { claimed: false };
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      if (
        stage.leaseId !== undefined &&
        stage.leaseExpiresAt !== undefined &&
        stage.leaseExpiresAt > now
      )
        return { claimed: false };
      const writer = yield* DatabaseWriter;
      yield* writer
        .table("buildPackStages")
        .patch(stage._id, {
          leaseId: leaseId.trim(),
          leaseExpiresAt: now + 10 * 60_000,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return {
        claimed: true,
        stage: stage.stageName as BuildPackStageName,
        attempt: stage.attempts,
      };
    }),
);

const persistCheckpointImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "persistCheckpoint",
  ({ packId, runJson, stage: leasedStage, leaseId, receipt }) =>
    Effect.gen(function* () {
      let run: BuildPackRun;
      try {
        run = JSON.parse(runJson) as BuildPackRun;
      } catch {
        return yield* new ValidationFailed({
          field: "runJson",
          message: "The Build Pack checkpoint is invalid.",
        });
      }
      const { pack, stages } = yield* loadPackRows(packId);
      if (run.packId !== packId)
        return yield* new ValidationFailed({
          field: "packId",
          message: "The checkpoint belongs to a different Build Pack.",
        });
      if ((leasedStage === undefined) !== (leaseId === undefined))
        return yield* new ValidationFailed({
          field: "lease",
          message: "A checkpoint stage and lease must be supplied together.",
        });
      if (leasedStage === undefined) {
        const runningChanged = stages.some((stored) => {
          if (stored.status !== "running") return false;
          const checkpoint = run.stages.find(
            ({ name }) => name === stored.stageName,
          );
          return (
            checkpoint !== undefined &&
            (checkpoint.status !== stored.status ||
              checkpoint.attempts !== stored.attempts ||
              checkpoint.output !== stored.outputJson ||
              checkpoint.error !== stored.errorCode)
          );
        });
        if (runningChanged)
          return yield* new ValidationFailed({
            field: "lease",
            message: "A matching stage lease is required for this checkpoint.",
          });
      }
      if (leasedStage !== undefined && leaseId !== undefined) {
        const leased = stages.find(
          ({ stageName }) => stageName === leasedStage,
        );
        const checkpoint = run.stages.find(({ name }) => name === leasedStage);
        if (
          !leased ||
          !checkpoint ||
          leased.status !== "running" ||
          leased.leaseId !== leaseId ||
          leased.attempts !== checkpoint.attempts
        )
          return yield* new ValidationFailed({
            field: "lease",
            message: "The Build Pack stage lease is stale or does not match.",
          });
      }
      const writer = yield* DatabaseWriter;
      const reader = yield* DatabaseReader;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      for (const stage of run.stages) {
        const stored = stages.find(({ stageName }) => stageName === stage.name);
        if (!stored)
          return yield* new NotFound({
            resource: "buildPackStages",
            id: `${packId}:${stage.name}`,
          });
        if (
          stored.status === "completed" &&
          (stage.status !== "completed" || stored.outputJson !== stage.output)
        )
          return yield* new ValidationFailed({
            field: "stage",
            message: "Completed Build Pack checkpoints are immutable.",
          });
        yield* writer
          .table("buildPackStages")
          .patch(stored._id, {
            status: stage.status,
            attempts: stage.attempts,
            ...(stage.output === undefined ? {} : { outputJson: stage.output }),
            ...(stage.error === undefined ? {} : { errorCode: stage.error }),
            estimatedCostCents:
              stage.name === receipt?.stage
                ? receipt.estimatedCents
                : stored.estimatedCostCents,
            ...(stage.name === leasedStage
              ? { leaseId: undefined, leaseExpiresAt: undefined }
              : {}),
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      yield* writer
        .table("buildPacks")
        .patch(pack._id, { status: run.status, updatedAt: now })
        .pipe(Effect.orDie);
      const supportStage = run.stages.find(
        ({ status }) => status === "needs-support",
      );
      if (run.status === "needs-support" && supportStage) {
        const entitlement = yield* reader
          .table("buildPackEntitlements")
          .index("by_report", (q) => q.eq("reportId", pack.reportId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (!entitlement)
          return yield* new NotFound({
            resource: "buildPackEntitlements",
            id: pack.reportId,
          });
        const incidentId = `support_${sha256Hex(
          `${packId}:${supportStage.name}:${String(supportStage.attempts)}`,
        ).slice(0, 24)}`;
        const existingIncident = yield* reader
          .table("supportIncidents")
          .index("by_incident", (q) => q.eq("incidentId", incidentId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (!existingIncident)
          yield* writer
            .table("supportIncidents")
            .insert({
              incidentId,
              packId,
              purchaseId: entitlement.purchaseId,
              failedStage: supportStage.name,
              status: "needs-support",
              createdAt: now,
              updatedAt: now,
            })
            .pipe(Effect.orDie);
      }
      if (receipt) {
        const existingReceipt = yield* reader
          .table("modelReceipts")
          .index("by_receipt", (q) => q.eq("receiptId", receipt.receiptId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (!existingReceipt)
          yield* writer
            .table("modelReceipts")
            .insert({
              receiptId: receipt.receiptId,
              sessionId: packId,
              reportId: pack.reportId,
              tier: "premium",
              stage: receipt.stage,
              provider: receipt.provider,
              mode: receipt.mode,
              model: receipt.model,
              repair: false,
              inputTokens: receipt.inputTokens,
              outputTokens: receipt.outputTokens,
              estimatedCents: receipt.estimatedCents,
              generatedAt: receipt.generatedAt,
            })
            .pipe(Effect.orDie);
      }
      const refreshed = run.stages.map((stage) => ({
        stageName: stage.name,
        status: stage.status,
        attempts: stage.attempts,
        ...(stage.output === undefined ? {} : { outputJson: stage.output }),
        ...(stage.error === undefined ? {} : { errorCode: stage.error }),
      }));
      return summaryFrom({ ...pack, status: run.status }, refreshed);
    }),
);

const finishPackImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "finishPack",
  ({ packId, canonicalPackJson }) =>
    Effect.gen(function* () {
      try {
        decodeCompleteBuildPack(JSON.parse(canonicalPackJson));
      } catch {
        return yield* new ValidationFailed({
          field: "canonicalPackJson",
          message: "The compiled Complete Build Pack is invalid.",
        });
      }
      const { pack, stages } = yield* loadPackRows(packId);
      const reader = yield* DatabaseReader;
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_report", (q) => q.eq("reportId", pack.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (entitlement?.status !== "active") {
        const writer = yield* DatabaseWriter;
        const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
        yield* writer
          .table("buildPacks")
          .patch(pack._id, { status: "revoked", updatedAt: now })
          .pipe(Effect.orDie);
        return summaryFrom({ ...pack, status: "revoked" }, stages);
      }
      if (!stages.every(({ status }) => status === "completed"))
        return yield* new ValidationFailed({
          field: "packId",
          message: "Every checkpoint must complete before compilation.",
        });
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("buildPacks")
        .patch(pack._id, {
          status: "completed",
          canonicalPackJson,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return summaryFrom({ ...pack, status: "completed" }, stages);
    }),
);

const fakeCompileOutput = (reportJson: string): string => {
  const report = JSON.parse(reportJson) as {
    readonly improvedIdea?: string;
    readonly biggestWeakness?: string;
    readonly whatItWillTake?: readonly string[];
  };
  return JSON.stringify({
    productBrief:
      report.improvedIdea ??
      "A focused product built around one useful outcome.",
    customerAndProblem:
      report.biggestWeakness ?? "A specific customer needs a clearer outcome.",
    scope: ["One measurable core workflow", "Operator review and recovery"],
    requirements: [
      "Complete the primary workflow end to end",
      "Make every provider failure recoverable",
    ],
    userJourneys: ["A customer reaches the first useful outcome"],
    dataModel: ["Organization — tenant account", "Workflow — durable outcome"],
    architecture:
      "A tenant-aware web application with durable state and server-only providers.",
    integrations: ["Authentication", "Transactional email", "Analytics"],
    securityAndPrivacy: ["Tenant isolation", "Content-free analytics"],
    deliveryPlan: report.whatItWillTake ?? ["Validate", "Build", "Pilot"],
    acceptanceCriteria: [
      "The primary journey works end to end",
      "Keyboard users can complete the primary journey",
    ],
    risks: [report.biggestWeakness ?? "Distribution evidence"],
    openQuestions: ["What outcome makes the first pilot pay?"],
    competitorClaims: [],
  });
};

const stagePrompt = ({
  stage,
  reportJson,
  completedOutputs,
}: {
  readonly stage: BuildPackStageName;
  readonly reportJson: string;
  readonly completedOutputs: Readonly<
    Partial<Record<BuildPackStageName, string>>
  >;
}) =>
  [
    `Complete premium Build Pack stage: ${stage}.`,
    "Use the saved free report and completed checkpoints below.",
    `Free report: ${reportJson}`,
    `Completed checkpoints: ${JSON.stringify(completedOutputs)}`,
    stage === "compile"
      ? "Return only valid JSON matching the Complete Build Pack schema. Every researched competitor claim must have at least one source URL."
      : "Return a specific, implementation-ready checkpoint. Do not use generic startup advice.",
  ].join("\n\n");

const runPackImpl = FunctionImpl.make(
  databaseSchema,
  packsGroup,
  "runPack",
  ({ packId }) =>
    Effect.gen(function* () {
      const query = yield* QueryRunner;
      const mutation = yield* MutationRunner;
      const loaded = yield* query(refs.internal.buildPacks.packs.loadPackRun, {
        packId,
      }).pipe(Effect.orDie);
      const initialRun = JSON.parse(loaded.runJson) as BuildPackRun;
      if (initialRun.status === "completed") {
        return {
          packId: initialRun.packId,
          reportId: initialRun.reportId,
          reportVersion: initialRun.reportVersion,
          status: initialRun.status,
          stages: initialRun.stages,
        };
      }
      const runtimeMode = yield* RuntimeModeConfig.pipe(Effect.orDie);
      const gatewayEnv = yield* loadLlmGatewayEnvConfig.pipe(Effect.orDie);
      const gateway = createLlmGateway({
        mode: runtimeMode,
        env: gatewayEnv,
        fakeCompletionText: (request) =>
          request.prompt.includes("stage: compile")
            ? fakeCompileOutput(loaded.reportJson)
            : `Completed ${request.prompt.match(/stage: ([^.]*)/)?.[1] ?? "premium"} checkpoint.`,
      });
      let usage: ModelUsage = {
        callsUsed: 0,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        repairAttemptsUsed: 0,
        spentCents: 0,
      };
      let latestReceipt:
        | {
            readonly receiptId: string;
            readonly stage: string;
            readonly provider: string;
            readonly mode: "fake" | "test" | "live";
            readonly model: string;
            readonly inputTokens: number;
            readonly outputTokens: number;
            readonly estimatedCents: number;
            readonly generatedAt: number;
          }
        | undefined;
      const runnerId = `${packId}.${crypto.randomUUID()}`;
      let activeLease:
        | { readonly stage: BuildPackStageName; readonly leaseId: string }
        | undefined;
      let leaseContended = false;
      const execution = yield* Effect.result(
        Effect.tryPromise({
          try: () =>
            executePremiumBuildPack({
              run: initialRun,
              runStage: async ({ stage, completedOutputs }) => {
                const leaseId = `${runnerId}.${stage}`;
                const claim = await Effect.runPromise(
                  mutation(refs.internal.buildPacks.packs.claimStage, {
                    packId,
                    leaseId,
                  }).pipe(Effect.orDie),
                );
                if (
                  !claim.claimed ||
                  claim.stage !== stage ||
                  claim.attempt === undefined
                ) {
                  leaseContended = true;
                  return Promise.reject(
                    new StageLeaseUnavailable({
                      message: "Build Pack stage is already leased.",
                    }),
                  );
                }
                const attempt = claim.attempt;
                activeLease = { stage, leaseId };
                const authorization = authorizeModelCall(
                  PREMIUM_MODEL_POLICY,
                  usage,
                );
                if (!authorization.allowed) {
                  return Promise.reject(
                    new PremiumBuildPackRuntimeError({
                      message: `Premium model policy: ${authorization.reason}`,
                      cause: authorization,
                    }),
                  );
                }
                const receiptId = `${packId}.${stage}.${String(attempt)}`;
                const completion = await Effect.runPromise(
                  gateway.complete({
                    workspaceSlug: "public-idea-funnel",
                    prompt: stagePrompt({
                      stage,
                      reportJson: loaded.reportJson,
                      completedOutputs,
                    }),
                    modelEnv: PREMIUM_MODEL_POLICY.modelEnv,
                    limits: {
                      maxInputTokens:
                        PREMIUM_MODEL_POLICY.maxInputTokens -
                        usage.inputTokensUsed,
                      maxOutputTokens: premiumStageOutputTokens[stage],
                    },
                    idempotencyKey: receiptId,
                    currentDailySpendCents:
                      loaded.currentDailySpendCents + usage.spentCents,
                  }),
                );
                usage = {
                  ...usage,
                  callsUsed: usage.callsUsed + 1,
                  inputTokensUsed:
                    usage.inputTokensUsed + completion.usage.promptTokens,
                  outputTokensUsed:
                    usage.outputTokensUsed + completion.usage.completionTokens,
                  spentCents:
                    usage.spentCents + completion.usage.estimatedCents,
                };
                latestReceipt = {
                  receiptId,
                  stage,
                  provider: completion.provider,
                  mode: completion.mode,
                  model: completion.model,
                  inputTokens: completion.usage.promptTokens,
                  outputTokens: completion.usage.completionTokens,
                  estimatedCents: completion.usage.estimatedCents,
                  generatedAt: Date.parse(completion.receipt.generatedAt),
                };
                return completion.text;
              },
              checkpoint: async (run) => {
                if (leaseContended) {
                  return Promise.reject(
                    new StageLeaseUnavailable({
                      message: "Build Pack stage is already leased.",
                    }),
                  );
                }
                if (!activeLease) {
                  return Promise.reject(
                    new PremiumBuildPackRuntimeError({
                      message: "Build Pack checkpoint has no active lease.",
                    }),
                  );
                }
                await Effect.runPromise(
                  mutation(refs.internal.buildPacks.packs.persistCheckpoint, {
                    packId,
                    runJson: JSON.stringify(run),
                    stage: activeLease.stage,
                    leaseId: activeLease.leaseId,
                    ...(latestReceipt === undefined
                      ? {}
                      : { receipt: latestReceipt }),
                  }).pipe(Effect.orDie),
                );
                latestReceipt = undefined;
                activeLease = undefined;
              },
            }),
          catch: (cause) =>
            cause instanceof StageLeaseUnavailable
              ? cause
              : cause instanceof PremiumBuildPackRuntimeError
                ? cause
                : new PremiumBuildPackRuntimeError({
                    message: "The premium Build Pack runtime did not complete.",
                    cause,
                  }),
        }),
      );
      if (Result.isFailure(execution)) {
        if (execution.failure instanceof StageLeaseUnavailable) {
          const refreshed = yield* query(
            refs.internal.buildPacks.packs.loadPackRun,
            { packId },
          ).pipe(Effect.orDie);
          const run = JSON.parse(refreshed.runJson) as BuildPackRun;
          return {
            packId: run.packId,
            reportId: run.reportId,
            reportVersion: run.reportVersion,
            status: run.status,
            stages: run.stages,
          };
        }
        return yield* new ConfigInvalid({
          provider: "openrouter",
          message: "Premium Build Pack generation could not run.",
        });
      }
      const executed = execution.success;
      if (executed.run.status !== "completed") {
        return {
          packId: executed.run.packId,
          reportId: executed.run.reportId,
          reportVersion: executed.run.reportVersion,
          status: executed.run.status,
          stages: executed.run.stages,
        };
      }
      const compiled = executed.run.stages.find(
        ({ name }) => name === "compile",
      )?.output;
      if (!compiled)
        return yield* new ValidationFailed({
          field: "compile",
          message: "The compiled Build Pack output is missing.",
        });
      return yield* mutation(refs.internal.buildPacks.packs.finishPack, {
        packId,
        canonicalPackJson: compiled,
      }).pipe(Effect.orDie);
    }),
);

export default GroupImpl.make(databaseSchema, packsGroup).pipe(
  Layer.provide(startPackImpl),
  Layer.provide(statusImpl),
  Layer.provide(retryFailedStageImpl),
  Layer.provide(getPackImpl),
  Layer.provide(runPackImpl),
  Layer.provide(loadPackRunImpl),
  Layer.provide(claimStageImpl),
  Layer.provide(persistCheckpointImpl),
  Layer.provide(finishPackImpl),
  GroupImpl.finalize,
);
