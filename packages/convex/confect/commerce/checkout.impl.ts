import { FunctionImpl, GroupImpl } from "@confect/server";
import {
  createDodoCheckout,
  createDodoSdkCheckoutTransport,
  type DodoCheckoutResult,
} from "@maestro-template/integrations";
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
} from "../_generated/services";
import {
  ConfigInvalid,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";
import { PublicBaseUrlConfig, RuntimeModeConfig } from "../shared/config";
import { loadDodoCommerceEnvConfig } from "../evaluator/providerConfig";
import { sha256Hex } from "../shared/sha256";
import checkoutGroup, { CheckoutUnavailable } from "./checkout.spec";
import prepareCheckoutImpl from "./checkoutPrepare.impl";

const BUILD_PACK_CURRENCY = "USD" as const;
const FAKE_PRODUCT_ID = "complete-build-pack-2900-usd";

const unsafeAssumeClockProvided = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const checkoutResult = (checkout: {
  readonly checkoutSessionId: string;
  readonly checkoutUrl?: string | undefined;
  readonly reportId: string;
  readonly amountCents: number;
  readonly currency: string;
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
  currency: BUILD_PACK_CURRENCY,
  status: checkout.status,
});

const persistCheckoutImpl = FunctionImpl.make(
  databaseSchema,
  checkoutGroup,
  "persistCheckout",
  ({ idempotencyKey, checkoutSessionId, checkoutUrl }) =>
    Effect.gen(function* () {
      if (
        !idempotencyKey.trim() ||
        !checkoutSessionId.trim() ||
        !checkoutUrl.trim()
      )
        return yield* new ValidationFailed({
          field: "checkout",
          message: "Dodo returned an incomplete checkout session.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const checkout = yield* reader
        .table("checkoutSessions")
        .index("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (checkout === null)
        return yield* new NotFound({
          resource: "checkoutSessions",
          id: idempotencyKey,
        });
      if (checkout.status !== "created" && checkout.checkoutUrl?.trim())
        return checkoutResult(checkout);

      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("checkoutSessions")
        .patch(checkout._id, {
          checkoutSessionId: checkoutSessionId.trim(),
          checkoutUrl: checkoutUrl.trim(),
          status: "checkout-open",
          updatedAt: now,
        })
        .pipe(Effect.orDie);
      return checkoutResult({
        ...checkout,
        checkoutSessionId: checkoutSessionId.trim(),
        checkoutUrl: checkoutUrl.trim(),
        status: "checkout-open",
      });
    }),
);

const createImpl = FunctionImpl.make(
  databaseSchema,
  checkoutGroup,
  "create",
  (input) =>
    Effect.gen(function* () {
      const mutation = yield* MutationRunner;
      const prepared = yield* mutation(
        refs.internal.commerce.checkout.prepareCheckout,
        input,
      ).pipe(
        Effect.catchTag(
          "SchemaError",
          () =>
            new ValidationFailed({
              field: "checkout",
              message: "The checkout request is invalid.",
            }),
        ),
      );
      if (prepared.existing !== null) return prepared.existing;

      const runtimeMode = yield* RuntimeModeConfig.pipe(
        Effect.mapError(
          () =>
            new ConfigInvalid({
              provider: "dodo",
              message: "TEMPLATE_RUNTIME_MODE is invalid.",
            }),
        ),
      );
      const publicBaseUrl = yield* PublicBaseUrlConfig.pipe(Effect.orDie);
      const dodoEnv = yield* loadDodoCommerceEnvConfig.pipe(Effect.orDie);
      if (
        runtimeMode !== "fake" &&
        (!dodoEnv.DODO_API_KEY ||
          !dodoEnv.DODO_BUILD_PACK_PRODUCT_ID ||
          (runtimeMode === "live" &&
            !dodoEnv.DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS))
      )
        return yield* new ConfigInvalid({
          provider: "dodo",
          message:
            "Dodo checkout requires DODO_API_KEY and DODO_BUILD_PACK_PRODUCT_ID.",
        });

      const returnUrl = new URL("/checkout/return", publicBaseUrl);
      returnUrl.searchParams.set("report_id", prepared.reportId);
      const created = yield* Effect.promise(() =>
        createDodoCheckout({
          mode: runtimeMode,
          apiKey: dodoEnv.DODO_API_KEY,
          productId: dodoEnv.DODO_BUILD_PACK_PRODUCT_ID ?? FAKE_PRODUCT_ID,
          reportId: prepared.reportId,
          ...(prepared.admaxxerVisitorId
            ? { admaxxerVisitorId: prepared.admaxxerVisitorId }
            : {}),
          customerEmail: prepared.customerEmail,
          returnUrl: returnUrl.toString(),
          idempotencyKey: prepared.idempotencyKey,
          ...(runtimeMode === "fake"
            ? {}
            : {
                transport: createDodoSdkCheckoutTransport({
                  environment:
                    runtimeMode === "live" ? "live_mode" : "test_mode",
                }),
              }),
        }),
      );
      if (!("checkoutSessionId" in created)) {
        if (created._tag === "DodoWebhookConfigError")
          return yield* new ConfigInvalid({
            provider: "dodo",
            message: "Dodo checkout configuration is incomplete.",
          });
        return yield* new CheckoutUnavailable({
          operation: "checkout.create",
          retryable: created.retryable,
        });
      }

      const providerCheckout: DodoCheckoutResult = created;
      return yield* mutation(refs.internal.commerce.checkout.persistCheckout, {
        idempotencyKey: prepared.idempotencyKey,
        checkoutSessionId: providerCheckout.checkoutSessionId,
        checkoutUrl: providerCheckout.checkoutUrl,
      }).pipe(
        Effect.catchTag(
          "SchemaError",
          () =>
            new CheckoutUnavailable({
              operation: "checkout.persist",
              retryable: true,
            }),
        ),
      );
    }),
);

const markReturnedImpl = FunctionImpl.make(
  databaseSchema,
  checkoutGroup,
  "markReturned",
  ({ checkoutSessionId }) =>
    Effect.gen(function* () {
      const normalized = checkoutSessionId.trim();
      if (!normalized)
        return yield* new ValidationFailed({
          field: "checkoutSessionId",
          message: "checkoutSessionId must not be blank.",
        });
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const checkout = yield* reader
        .table("checkoutSessions")
        .index("by_checkout", (q) => q.eq("checkoutSessionId", normalized))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      if (checkout === null)
        return yield* new NotFound({
          resource: "checkoutSessions",
          id: normalized,
        });
      if (
        checkout.status === "paid" ||
        checkout.status === "refunded" ||
        checkout.status === "disputed"
      )
        return checkoutResult(checkout);

      const now = yield* unsafeAssumeClockProvided(Clock.currentTimeMillis);
      yield* writer
        .table("checkoutSessions")
        .patch(checkout._id, { status: "payment-pending", updatedAt: now })
        .pipe(Effect.orDie);
      return checkoutResult({ ...checkout, status: "payment-pending" });
    }),
);

const statusImpl = FunctionImpl.make(
  databaseSchema,
  checkoutGroup,
  "status",
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
        ownership.ownerAccessTokenHash !== sha256Hex(normalizedToken)
      )
        return yield* new Unauthorized();

      const purchase = yield* reader
        .table("purchases")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const checkout = yield* reader
        .table("checkoutSessions")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const entitlement = yield* reader
        .table("buildPackEntitlements")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const credit = yield* reader
        .table("maestroCredits")
        .index("by_report", (q) => q.eq("reportId", normalizedReportId))
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);

      return {
        reportId: normalizedReportId,
        purchaseStatus: purchase?.status ?? checkout?.status ?? "missing",
        entitlementStatus: entitlement?.status ?? "missing",
        maestroCreditStatus: credit?.status ?? "missing",
        ...(credit === null || credit === undefined
          ? {}
          : { maestroCreditAmountCents: credit.amountCents }),
      };
    }),
);

export default GroupImpl.make(databaseSchema, checkoutGroup).pipe(
  Layer.provide(createImpl),
  Layer.provide(prepareCheckoutImpl),
  Layer.provide(persistCheckoutImpl),
  Layer.provide(markReturnedImpl),
  Layer.provide(statusImpl),
  GroupImpl.finalize,
);
