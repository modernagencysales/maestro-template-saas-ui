import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import {
  ConfigInvalid,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";
import {
  consumeEmailVerificationChallenge,
  issueEmailVerificationChallenge,
} from "../evaluator/ownership";
import { sha256Hex } from "../shared/sha256";
import { RuntimeModeConfig } from "../shared/config";
import {
  normalizeManageEvaluationReportInput,
  validateManageEvaluationReportInput,
} from "./manageEvaluationReport.domain";
import manageEvaluationReportGroup from "./manageEvaluationReport.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const manageEvaluationReportImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "manageEvaluationReport",
  (rawInput) =>
    Effect.gen(function* () {
      const input = normalizeManageEvaluationReportInput({
        reportId: rawInput.reportId,
        accessToken: rawInput.accessToken,
        action: rawInput.action,
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
      if (session.accessTokenHash !== sha256Hex(input.accessToken))
        return yield* new Unauthorized();
      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);

      if (input.action === "revise") {
        const version = report.currentVersion + 1;
        yield* writer
          .table("evaluationReportVersions")
          .insert({
            reportId: report.reportId,
            version,
            reportJson: input.revisionJson ?? "",
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
        const shareToken = `share_${sha256Hex(`${input.accessToken}:${report.reportId}:${report.currentVersion}:${now}`).slice(0, 40)}`;
        yield* writer
          .table("evaluationShares")
          .insert({
            shareTokenHash: sha256Hex(shareToken),
            reportId: report.reportId,
            reportVersion: report.currentVersion,
            status: "active",
            publicSnapshotJson: currentVersion.reportJson,
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
      yield* writer
        .table("evaluationReports")
        .delete(report._id)
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

const requestReportEmailVerificationImpl = FunctionImpl.make(
  databaseSchema,
  manageEvaluationReportGroup,
  "requestReportEmailVerification",
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
      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.orElseSucceed(() => "fake" as const),
      );
      if (runtimeMode === "live")
        return yield* new ConfigInvalid({
          provider: "mailersend",
          message: "Live report verification email delivery is not configured.",
        });
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
        status: "verification-sent" as const,
        challengeId,
        fakeVerificationUrl: `/verify-report?token=${encodeURIComponent(verificationToken)}`,
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
  Layer.provide(consumeReportEmailVerificationImpl),
  Layer.provide(listOwnedEvaluationReportsImpl),
  GroupImpl.finalize,
);
