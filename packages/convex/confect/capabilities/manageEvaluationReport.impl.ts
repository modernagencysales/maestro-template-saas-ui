import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  FREE_MODEL_POLICY,
  decodeBuildabilityReport,
  type BuildabilityReport,
} from "@maestro-template/app-idea-evaluator";
import { createLlmGateway } from "@maestro-template/integrations";
import {
  createFunnelLifecycleEmailService,
  createMailerSendTransport,
} from "@maestro-template/notifications";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
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
  Forbidden,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";
import {
  consumeEmailVerificationChallenge,
  issueEmailVerificationChallenge,
} from "../evaluator/ownership";
import { createPublicEvaluationReportSnapshot } from "../evaluator/sharing";
import { sha256Hex } from "../shared/sha256";
import {
  loadMailerSendEnvConfig,
  loadLlmGatewayEnvConfig,
  PublicBaseUrlConfig,
  RuntimeModeConfig,
} from "../shared/config";
import {
  normalizeManageEvaluationReportInput,
  validateManageEvaluationReportInput,
} from "./manageEvaluationReport.domain";
import manageEvaluationReportGroup from "./manageEvaluationReport.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const requireReportOwner = (reportId: string, ownerAccessToken: string) =>
  Effect.gen(function* () {
    const normalizedReportId = reportId.trim();
    const normalizedToken = ownerAccessToken.trim();
    if (!normalizedReportId || !normalizedToken)
      return yield* new ValidationFailed({
        field: "credentials",
        message: "A report and verified owner token are required.",
      });
    const reader = yield* DatabaseReader;
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
    return { report, ownership, ownerAccessToken: normalizedToken };
  });

const manageEvaluationReportImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "manageEvaluationReport",
  (rawInput) =>
    Effect.gen(function* () {
      const input = normalizeManageEvaluationReportInput({
        reportId: rawInput.reportId,
        action: rawInput.action,
        ...(rawInput.accessToken === undefined
          ? {}
          : { accessToken: rawInput.accessToken }),
        ...(rawInput.ownerAccessToken === undefined
          ? {}
          : { ownerAccessToken: rawInput.ownerAccessToken }),
        ...(rawInput.revisionJson === undefined
          ? {}
          : { revisionJson: rawInput.revisionJson }),
      });
      const errors = validateManageEvaluationReportInput(input);
      if (errors.length > 0)
        return yield* new ValidationFailed({
          field: "action",
          message: errors.join(" "),
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const report = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", input.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (report === null)
        return yield* new NotFound({
          resource: "evaluationReports",
          id: input.reportId,
        });
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", report.sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (session === null)
        return yield* new NotFound({
          resource: "evaluationSessions",
          id: report.sessionId,
        });
      let authorized =
        input.accessToken !== undefined &&
        session.accessTokenHash === sha256Hex(input.accessToken);
      if (!authorized && input.ownerAccessToken !== undefined) {
        const ownership = yield* reader
          .table("reportOwnerships")
          .index("by_report", (q) => q.eq("reportId", report.reportId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        authorized =
          ownership !== null &&
          ownership.ownerAccessTokenHash === sha256Hex(input.ownerAccessToken);
      }
      if (!authorized) return yield* new Unauthorized();
      const credentialSeed = input.accessToken ?? input.ownerAccessToken;
      if (credentialSeed === undefined) return yield* new Unauthorized();
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);

      if (input.action === "revise") {
        let revisionJson: string;
        try {
          revisionJson = JSON.stringify(
            decodeBuildabilityReport(JSON.parse(input.revisionJson ?? "")),
          );
        } catch {
          return yield* new ValidationFailed({
            field: "revisionJson",
            message: "Revision must be a complete, valid Buildability Report.",
          });
        }
        const version = report.currentVersion + 1;
        yield* writer
          .table("evaluationReportVersions")
          .insert({
            reportId: report.reportId,
            version,
            reportJson: revisionJson,
            createdAt: now,
          })
          .pipe(Effect.orDie);
        yield* writer
          .table("evaluationReports")
          .patch(report._id, { currentVersion: version, updatedAt: now })
          .pipe(Effect.orDie);
        return {
          status: "revised" as const,
          reportId: report.reportId,
          version,
        };
      }

      const shares = yield* reader
        .table("evaluationShares")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      const activeShare = shares.find((share) => share.status === "active");
      if (input.action === "share") {
        if (activeShare !== undefined) {
          return yield* new ValidationFailed({
            field: "action",
            message:
              "An active share already exists. Revoke it before creating another.",
          });
        }
        const currentVersion = yield* reader
          .table("evaluationReportVersions")
          .index("by_report_version", (q) =>
            q
              .eq("reportId", report.reportId)
              .eq("version", report.currentVersion),
          )
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (currentVersion === null)
          return yield* new NotFound({
            resource: "evaluationReportVersions",
            id: `${report.reportId}:${report.currentVersion}`,
          });
        let publicSnapshotJson: string;
        try {
          publicSnapshotJson = JSON.stringify(
            createPublicEvaluationReportSnapshot(
              report.reportId,
              currentVersion.reportJson,
            ),
          );
        } catch {
          return yield* new ValidationFailed({
            field: "report",
            message: "This report cannot be safely shared.",
          });
        }
        const shareToken = `share_${sha256Hex(`${credentialSeed}:${report.reportId}:${report.currentVersion}:${now}`).slice(0, 40)}`;
        yield* writer
          .table("evaluationShares")
          .insert({
            shareTokenHash: sha256Hex(shareToken),
            reportId: report.reportId,
            reportVersion: report.currentVersion,
            status: "active",
            publicSnapshotJson,
            createdAt: now,
          })
          .pipe(Effect.orDie);
        return {
          status: "shared" as const,
          reportId: report.reportId,
          version: report.currentVersion,
          shareToken,
        };
      }
      if (input.action === "revoke-share") {
        if (activeShare !== undefined)
          yield* writer
            .table("evaluationShares")
            .patch(activeShare._id, { status: "revoked", revokedAt: now })
            .pipe(Effect.orDie);
        return {
          status: "revoked" as const,
          reportId: report.reportId,
          version: report.currentVersion,
        };
      }
      if (input.action === "claim") {
        return yield* new ValidationFailed({
          field: "action",
          message: "Claiming requires an authenticated user identity.",
        });
      }

      const purchase = yield* reader
        .table("purchases")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (purchase !== null)
        return yield* new Forbidden({
          reason:
            "Purchased reports require support-assisted deletion so financial audit records remain intact.",
        });

      for (const share of shares)
        yield* writer
          .table("evaluationShares")
          .delete(share._id)
          .pipe(Effect.orDie);
      const versions = yield* reader
        .table("evaluationReportVersions")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      for (const version of versions)
        yield* writer
          .table("evaluationReportVersions")
          .delete(version._id)
          .pipe(Effect.orDie);
      const challenges = yield* reader
        .table("emailVerificationChallenges")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      for (const challenge of challenges)
        yield* writer
          .table("emailVerificationChallenges")
          .delete(challenge._id)
          .pipe(Effect.orDie);
      const ownership = yield* reader
        .table("reportOwnerships")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (ownership !== null)
        yield* writer
          .table("reportOwnerships")
          .delete(ownership._id)
          .pipe(Effect.orDie);
      const checkoutSessions = yield* reader
        .table("checkoutSessions")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      for (const checkout of checkoutSessions)
        yield* writer
          .table("checkoutSessions")
          .delete(checkout._id)
          .pipe(Effect.orDie);
      const answers = yield* reader
        .table("evaluationAnswers")
        .index("by_session", (q) => q.eq("sessionId", report.sessionId))
        .collect()
        .pipe(Effect.orDie);
      for (const answer of answers)
        yield* writer
          .table("evaluationAnswers")
          .delete(answer._id)
          .pipe(Effect.orDie);
      yield* writer
        .table("evaluationReports")
        .delete(report._id)
        .pipe(Effect.orDie);
      yield* writer
        .table("evaluationSessions")
        .delete(session._id)
        .pipe(Effect.orDie);
      return {
        status: "deleted" as const,
        reportId: report.reportId,
        version: report.currentVersion,
      };
    }),
);

const getSharedEvaluationReportImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "getSharedEvaluationReport",
  ({ shareToken }) =>
    Effect.gen(function* () {
      const normalized = shareToken.trim();
      if (!normalized)
        return yield* new ValidationFailed({
          field: "shareToken",
          message: "shareToken must not be blank.",
        });
      const reader = yield* DatabaseReader;
      const share = yield* reader
        .table("evaluationShares")
        .index("by_token_hash", (q) =>
          q.eq("shareTokenHash", sha256Hex(normalized)),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (share === null || share.status !== "active") return null;
      return {
        reportId: share.reportId,
        reportVersion: share.reportVersion,
        publicSnapshotJson: share.publicSnapshotJson,
      };
    }),
);

const getEvaluationReportImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "getEvaluationReport",
  ({ reportId, accessToken, ownerAccessToken }) =>
    Effect.gen(function* () {
      const normalizedReportId = reportId.trim();
      if (
        !normalizedReportId ||
        (!accessToken?.trim() && !ownerAccessToken?.trim())
      )
        return yield* new ValidationFailed({
          field: "credentials",
          message: "A report id and access credential are required.",
        });
      const reader = yield* DatabaseReader;
      const report = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (report === null)
        return yield* new NotFound({
          resource: "evaluationReports",
          id: normalizedReportId,
        });
      let authorized = false;
      if (accessToken?.trim()) {
        const session = yield* reader
          .table("evaluationSessions")
          .index("by_session", (q) => q.eq("sessionId", report.sessionId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        authorized =
          session !== null &&
          session.accessTokenHash === sha256Hex(accessToken.trim());
      }
      if (!authorized && ownerAccessToken?.trim()) {
        const ownership = yield* reader
          .table("reportOwnerships")
          .index("by_report", (q) => q.eq("reportId", report.reportId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        authorized =
          ownership !== null &&
          ownership.ownerAccessTokenHash === sha256Hex(ownerAccessToken.trim());
      }
      if (!authorized) return yield* new Unauthorized();
      const version = yield* reader
        .table("evaluationReportVersions")
        .index("by_report_version", (q) =>
          q
            .eq("reportId", report.reportId)
            .eq("version", report.currentVersion),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (version === null)
        return yield* new NotFound({
          resource: "evaluationReportVersions",
          id: `${report.reportId}:${String(report.currentVersion)}`,
        });
      return {
        reportId: report.reportId,
        currentVersion: report.currentVersion,
        reportJson: version.reportJson,
        verdict: report.verdict,
        overallScore: report.overallScore,
        updatedAt: report.updatedAt,
      };
    }),
);

const getReportRevisionContextImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "getReportRevisionContext",
  ({ reportId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const { report } = yield* requireReportOwner(reportId, ownerAccessToken);
      const reader = yield* DatabaseReader;
      const version = yield* reader
        .table("evaluationReportVersions")
        .index("by_report_version", (q) =>
          q
            .eq("reportId", report.reportId)
            .eq("version", report.currentVersion),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (!version)
        return yield* new NotFound({
          resource: "evaluationReportVersions",
          id: `${report.reportId}:${String(report.currentVersion)}`,
        });
      const receipts = yield* reader
        .table("modelReceipts")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      return {
        reportId: report.reportId,
        sessionId: report.sessionId,
        currentVersion: report.currentVersion,
        currentReportJson: version.reportJson,
        currentDailySpendCents: receipts.reduce(
          (sum, receipt) => sum + receipt.estimatedCents,
          0,
        ),
      };
    }),
);

const persistGeneratedReportRevisionImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "persistGeneratedReportRevision",
  ({
    reportId,
    ownerAccessToken,
    expectedCurrentVersion,
    reportJson,
    receipt,
  }) =>
    Effect.gen(function* () {
      const { report } = yield* requireReportOwner(reportId, ownerAccessToken);
      if (report.currentVersion !== expectedCurrentVersion)
        return yield* new ValidationFailed({
          field: "expectedCurrentVersion",
          message:
            "This report changed while the revision was running. Review the latest version and try again.",
        });
      let canonicalReport: BuildabilityReport;
      try {
        canonicalReport = decodeBuildabilityReport(JSON.parse(reportJson));
      } catch {
        return yield* new ValidationFailed({
          field: "reportJson",
          message: "The generated revision is not a valid report.",
        });
      }
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const nextVersion = expectedCurrentVersion + 1;
      const canonicalReportJson = JSON.stringify(canonicalReport);
      yield* writer
        .table("evaluationReportVersions")
        .insert({
          reportId: report.reportId,
          version: nextVersion,
          reportJson: canonicalReportJson,
          createdAt: now,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("evaluationReports")
        .patch(report._id, {
          currentVersion: nextVersion,
          verdict: canonicalReport.verdict,
          overallScore: canonicalReport.overallScore,
          updatedAt: now,
        })
        .pipe(Effect.orDie);
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
            sessionId: report.sessionId,
            reportId: report.reportId,
            tier: "free",
            stage: "revision",
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
      return {
        status: "revised" as const,
        reportId: report.reportId,
        version: nextVersion,
      };
    }),
);

const stripJsonFence = (value: string): string =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();

const reviseEvaluationReportWithModelImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "reviseEvaluationReportWithModel",
  ({ reportId, ownerAccessToken, feedback }) =>
    Effect.gen(function* () {
      const normalizedFeedback = feedback.trim();
      if (normalizedFeedback.length < 10 || normalizedFeedback.length > 2_000)
        return yield* new ValidationFailed({
          field: "feedback",
          message:
            "Describe the change in at least 10 characters and no more than 2,000.",
        });
      const query = yield* QueryRunner;
      const mutation = yield* MutationRunner;
      const context = yield* query(
        refs.internal.capabilities.manageEvaluationReport
          .getReportRevisionContext,
        { reportId, ownerAccessToken },
      ).pipe(Effect.orDie);
      const currentReport = decodeBuildabilityReport(
        JSON.parse(context.currentReportJson),
      );
      const runtimeMode = yield* RuntimeModeConfig.pipe(Effect.orDie);
      const gatewayEnv = yield* loadLlmGatewayEnvConfig.pipe(Effect.orDie);
      const gateway = createLlmGateway({
        mode: runtimeMode,
        env: gatewayEnv,
        fakeCompletionText: () =>
          JSON.stringify({
            ...currentReport,
            improvedIdea: `${currentReport.improvedIdea} Revision focus: ${normalizedFeedback}`,
          }),
      });
      const receiptId = `revision.${reportId}.${String(context.currentVersion + 1)}`;
      const generated = yield* gateway
        .complete({
          workspaceSlug: "public-idea-funnel",
          prompt: [
            "Revise this app-idea evaluation using the verified owner's feedback.",
            "Return only a complete JSON BuildabilityReport with exactly the same fields. Do not include Markdown or hidden analysis.",
            `Current report: ${context.currentReportJson}`,
            `Owner feedback: ${normalizedFeedback}`,
          ].join("\n\n"),
          modelEnv: FREE_MODEL_POLICY.modelEnv,
          limits: {
            maxInputTokens: FREE_MODEL_POLICY.maxInputTokens,
            maxOutputTokens: FREE_MODEL_POLICY.maxOutputTokens,
          },
          idempotencyKey: receiptId,
          currentDailySpendCents: context.currentDailySpendCents,
        })
        .pipe(
          Effect.mapError(
            () =>
              new Forbidden({
                reason:
                  "The revision could not finish. Your current report is unchanged, so try again.",
              }),
          ),
        );
      let canonicalReportJson: string;
      try {
        canonicalReportJson = JSON.stringify(
          decodeBuildabilityReport(JSON.parse(stripJsonFence(generated.text))),
        );
      } catch {
        return yield* new Forbidden({
          reason:
            "The revision could not be validated. Your current report is unchanged, so try again.",
        });
      }
      return yield* mutation(
        refs.internal.capabilities.manageEvaluationReport
          .persistGeneratedReportRevision,
        {
          reportId,
          ownerAccessToken,
          expectedCurrentVersion: context.currentVersion,
          reportJson: canonicalReportJson,
          receipt: {
            receiptId,
            provider: generated.provider,
            mode: generated.mode,
            model: generated.model,
            inputTokens: generated.usage.promptTokens,
            outputTokens: generated.usage.completionTokens,
            estimatedCents: generated.usage.estimatedCents,
            generatedAt: Date.parse(generated.receipt.generatedAt),
          },
        },
      ).pipe(Effect.orDie);
    }),
);

const listEvaluationReportVersionsImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "listEvaluationReportVersions",
  ({ reportId, ownerAccessToken }) =>
    Effect.gen(function* () {
      const { report } = yield* requireReportOwner(reportId, ownerAccessToken);
      const reader = yield* DatabaseReader;
      const versions = yield* reader
        .table("evaluationReportVersions")
        .index("by_report", (q) => q.eq("reportId", report.reportId))
        .collect()
        .pipe(Effect.orDie);
      return [...versions]
        .sort((left, right) => left.version - right.version)
        .map(({ version, reportJson, createdAt }) => ({
          version,
          reportJson,
          createdAt,
        }));
    }),
);

const issueReportEmailVerificationImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "issueReportEmailVerification",
  ({ reportId, accessToken, email }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const report = yield* reader
        .table("evaluationReports")
        .index("by_report", (q) => q.eq("reportId", reportId.trim()))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (report === null)
        return yield* new NotFound({
          resource: "evaluationReports",
          id: reportId,
        });
      const session = yield* reader
        .table("evaluationSessions")
        .index("by_session", (q) => q.eq("sessionId", report.sessionId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        session === null ||
        session.accessTokenHash !== sha256Hex(accessToken.trim())
      )
        return yield* new Unauthorized();
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const verificationToken = `verify_${crypto.randomUUID()}`;
      const challengeId = `challenge_${crypto.randomUUID()}`;
      let issued;
      try {
        issued = issueEmailVerificationChallenge({
          reportId: report.reportId,
          email,
          verificationToken,
          now,
          ttlMs: 30 * 60 * 1_000,
        });
      } catch {
        return yield* new ValidationFailed({
          field: "email",
          message: "Enter a valid email address.",
        });
      }
      yield* writer
        .table("emailVerificationChallenges")
        .insert({
          challengeId,
          ...issued.challenge,
        })
        .pipe(Effect.orDie);
      return {
        status: "verification-issued" as const,
        challengeId,
        reportId: report.reportId,
        email,
        verificationUrlPath: `/verify-report?token=${encodeURIComponent(verificationToken)}`,
      };
    }),
);

const requestReportEmailVerificationImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "requestReportEmailVerification",
  (input) =>
    Effect.gen(function* () {
      const mutation = yield* MutationRunner;
      const issued = yield* mutation(
        refs.internal.capabilities.manageEvaluationReport
          .issueReportEmailVerification,
        input,
      ).pipe(
        Effect.catchTag(
          "ParseError",
          () =>
            new ValidationFailed({
              field: "email",
              message: "The verification request was invalid.",
            }),
        ),
      );
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.orElseSucceed(() => "fake" as const),
      );
      const publicBaseUrl = yield* PublicBaseUrlConfig.pipe(Effect.orDie);
      const mailerEnv = yield* loadMailerSendEnvConfig.pipe(Effect.orDie);
      if (
        runtimeMode === "live" &&
        (!mailerEnv.MAILERSEND_API_KEY || !mailerEnv.MAILERSEND_FROM_EMAIL)
      )
        return yield* new ConfigInvalid({
          provider: "mailersend",
          message:
            "MailerSend requires MAILERSEND_API_KEY and MAILERSEND_FROM_EMAIL.",
        });

      const destinationUrl = new URL(
        issued.verificationUrlPath,
        publicBaseUrl,
      ).toString();
      const service = createFunnelLifecycleEmailService({
        mode: runtimeMode,
        from: mailerEnv.MAILERSEND_FROM_EMAIL ?? "reports@example.test",
        ...(runtimeMode === "live"
          ? {
              transport: createMailerSendTransport({
                apiKey: mailerEnv.MAILERSEND_API_KEY ?? "",
              }),
            }
          : {}),
      });
      const delivery = yield* Effect.promise(() =>
        service.send({
          kind: "verify-report-email",
          to: issued.email,
          reportId: issued.reportId,
          destinationUrl,
        }),
      );
      if (!delivery.ok)
        return yield* new ConfigInvalid({
          provider: "mailersend",
          message: "The verification email could not be delivered.",
        });

      return {
        status: "verification-sent" as const,
        challengeId: issued.challengeId,
        ...(runtimeMode === "live"
          ? {}
          : { fakeVerificationUrl: issued.verificationUrlPath }),
      };
    }),
);

const consumeReportEmailVerificationImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "consumeReportEmailVerification",
  ({ verificationToken }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const challenge = yield* reader
        .table("emailVerificationChallenges")
        .index("by_token_hash", (q) =>
          q.eq("verificationTokenHash", sha256Hex(verificationToken.trim())),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (challenge === null)
        return yield* new NotFound({
          resource: "emailVerificationChallenges",
          id: "verification-token",
        });
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      const ownerAccessToken = `owner_${crypto.randomUUID()}`;
      let consumed;
      try {
        consumed = consumeEmailVerificationChallenge({
          challenge: {
            reportId: challenge.reportId,
            emailHash: challenge.emailHash,
            verificationTokenHash: challenge.verificationTokenHash,
            status: challenge.status,
            createdAt: challenge.createdAt,
            expiresAt: challenge.expiresAt,
            ...(challenge.consumedAt === undefined
              ? {}
              : { consumedAt: challenge.consumedAt }),
          },
          verificationToken: verificationToken.trim(),
          ownerAccessToken,
          now,
        });
      } catch {
        return yield* new ValidationFailed({
          field: "verificationToken",
          message:
            "This verification link is invalid, expired, or already used.",
        });
      }
      yield* writer
        .table("emailVerificationChallenges")
        .patch(challenge._id, {
          status: "consumed",
          consumedAt: now,
        })
        .pipe(Effect.orDie);
      const existing = yield* reader
        .table("reportOwnerships")
        .index("by_report", (q) => q.eq("reportId", challenge.reportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (existing !== null && existing.emailHash !== consumed.claim.emailHash)
        return yield* new Unauthorized();
      if (existing === null)
        yield* writer
          .table("reportOwnerships")
          .insert(consumed.claim)
          .pipe(Effect.orDie);
      else
        yield* writer
          .table("reportOwnerships")
          .patch(existing._id, {
            ownerAccessTokenHash: consumed.claim.ownerAccessTokenHash,
            claimedAt: now,
          })
          .pipe(Effect.orDie);
      return {
        status: "claimed" as const,
        reportId: challenge.reportId,
        ownerAccessToken,
      };
    }),
);

const listOwnedEvaluationReportsImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "listOwnedEvaluationReports",
  ({ ownerAccessToken }) =>
    Effect.gen(function* () {
      const token = ownerAccessToken.trim();
      if (!token)
        return yield* new ValidationFailed({
          field: "ownerAccessToken",
          message: "ownerAccessToken must not be blank.",
        });
      const reader = yield* DatabaseReader;
      const ownerships = yield* reader
        .table("reportOwnerships")
        .index("by_owner_token", (q) =>
          q.eq("ownerAccessTokenHash", sha256Hex(token)),
        )
        .collect()
        .pipe(Effect.orDie);
      const reports = [];
      for (const ownership of ownerships) {
        const report = yield* reader
          .table("evaluationReports")
          .index("by_report", (q) => q.eq("reportId", ownership.reportId))
          .first()
          .pipe(Effect.map(Option.getOrNull), Effect.orDie);
        if (report !== null)
          reports.push({
            reportId: report.reportId,
            currentVersion: report.currentVersion,
            verdict: report.verdict,
            overallScore: report.overallScore,
            updatedAt: report.updatedAt,
          });
      }
      return reports.sort((left, right) => right.updatedAt - left.updatedAt);
    }),
);

export default GroupImpl.make(databaseSchema, manageEvaluationReportGroup).pipe(
  Layer.provide(manageEvaluationReportImpl),
  Layer.provide(getSharedEvaluationReportImpl),
  Layer.provide(getEvaluationReportImpl),
  Layer.provide(requestReportEmailVerificationImpl),
  Layer.provide(issueReportEmailVerificationImpl),
  Layer.provide(consumeReportEmailVerificationImpl),
  Layer.provide(listOwnedEvaluationReportsImpl),
  Layer.provide(reviseEvaluationReportWithModelImpl),
  Layer.provide(getReportRevisionContextImpl),
  Layer.provide(persistGeneratedReportRevisionImpl),
  Layer.provide(listEvaluationReportVersionsImpl),
  GroupImpl.finalize,
);
