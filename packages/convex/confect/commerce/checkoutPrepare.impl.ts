import { FunctionImpl } from "@confect/server";
import { normalizeAdmaxxerVisitorId } from "@maestro-template/integrations";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { NotFound, Unauthorized, ValidationFailed } from "../errors";
import { sha256Hex } from "../shared/sha256";
import checkoutGroup from "./checkout.spec";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const checkoutResult = (checkout: {
  readonly checkoutSessionId: string;
  readonly checkoutUrl?: string | undefined;
  readonly reportId: string;
  readonly amountCents: number;
  readonly status:
    | "created"
    | "checkout-open"
    | "payment-pending"
    | "paid"
    | "failed"
    | "refunded"
    | "disputed";
}) => ({
  checkoutSessionId: checkout.checkoutSessionId,
  checkoutUrl: checkout.checkoutUrl ?? "",
  reportId: checkout.reportId,
  amountCents: checkout.amountCents,
  currency: "USD",
  status: checkout.status,
});

export default FunctionImpl.make(
  databaseSchema,
  checkoutGroup,
  "prepareCheckout",
  ({ reportId, ownerAccessToken, email, admaxxerVisitorId }) =>
    Effect.gen(function* () {
      const normalizedReportId = reportId.trim();
      const normalizedToken = ownerAccessToken.trim();
      const customerEmail = email.trim().toLowerCase();
      const visitorId = normalizeAdmaxxerVisitorId(admaxxerVisitorId);
      if (
        !normalizedReportId ||
        !normalizedToken ||
        !customerEmail.includes("@")
      )
        return yield* new ValidationFailed({
          field: "checkout",
          message: "A report, owner token, and valid email are required.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
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
      const ownership = yield* reader
        .table("reportOwnerships")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        ownership === null ||
        ownership.ownerAccessTokenHash !== sha256Hex(normalizedToken) ||
        ownership.emailHash !== sha256Hex(customerEmail)
      )
        return yield* new Unauthorized();
      const idempotencyKey = `build-pack:${sha256Hex(`${normalizedReportId}:${ownership.emailHash}`).slice(0, 48)}`;
      const existing = yield* reader
        .table("checkoutSessions")
        .index("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (
        existing !== null &&
        existing.status !== "created" &&
        existing.checkoutUrl?.trim()
      )
        return {
          reportId: normalizedReportId,
          customerEmail,
          ...(visitorId ? { admaxxerVisitorId: visitorId } : {}),
          idempotencyKey,
          existing: checkoutResult(existing),
        };
      if (existing === null) {
        const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
        yield* writer
          .table("checkoutSessions")
          .insert({
            checkoutSessionId: `pending_${sha256Hex(idempotencyKey).slice(0, 24)}`,
            reportId: normalizedReportId,
            ...(visitorId ? { admaxxerVisitorId: visitorId } : {}),
            idempotencyKey,
            amountCents: 2_900,
            currency: "USD",
            status: "created",
            createdAt: now,
            updatedAt: now,
          })
          .pipe(Effect.orDie);
      }
      return {
        reportId: normalizedReportId,
        customerEmail,
        ...(visitorId ? { admaxxerVisitorId: visitorId } : {}),
        idempotencyKey,
        existing: null,
      };
    }),
);
