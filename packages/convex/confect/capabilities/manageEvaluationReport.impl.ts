import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import { sha256Hex } from "../shared/sha256";
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

export default GroupImpl.make(databaseSchema, manageEvaluationReportGroup).pipe(
  Layer.provide(manageEvaluationReportImpl),
  Layer.provide(getSharedEvaluationReportImpl),
  GroupImpl.finalize,
);
