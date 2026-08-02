import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import {
  ConfigInvalid,
  NotFound,
  Unauthorized,
  ValidationFailed,
} from "../errors";

const CheckoutStatus = Schema.Literals([
  "created",
  "checkout-open",
  "payment-pending",
  "paid",
  "failed",
  "refunded",
  "disputed",
]);

const CheckoutResult = Schema.Struct({
  checkoutSessionId: Schema.String,
  checkoutUrl: Schema.String,
  reportId: Schema.String,
  amountCents: Schema.Number,
  currency: Schema.Literal("USD"),
  status: CheckoutStatus,
});

const CheckoutErrors = Schema.Union([
  Unauthorized,
  ValidationFailed,
  NotFound,
  ConfigInvalid,
]);

export class CheckoutUnavailable extends Schema.TaggedErrorClass<CheckoutUnavailable>()(
  "CheckoutUnavailable",
  {
    operation: Schema.String,
    retryable: Schema.Boolean,
  },
) {}

export const create = FunctionSpec.publicAction({
  name: "create",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
      email: Schema.String,
    }),
  returns: () => CheckoutResult,
  error: () => Schema.Union([CheckoutErrors, CheckoutUnavailable]),
});

export const prepareCheckout = FunctionSpec.internalMutation({
  name: "prepareCheckout",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
      email: Schema.String,
    }),
  returns: () =>
    Schema.Struct({
      reportId: Schema.String,
      customerEmail: Schema.String,
      idempotencyKey: Schema.String,
      existing: Schema.NullOr(CheckoutResult),
    }),
  error: () => Schema.Union([Unauthorized, ValidationFailed, NotFound]),
});

export const persistCheckout = FunctionSpec.internalMutation({
  name: "persistCheckout",
  args: () =>
    Schema.Struct({
      idempotencyKey: Schema.String,
      checkoutSessionId: Schema.String,
      checkoutUrl: Schema.String,
    }),
  returns: () => CheckoutResult,
  error: () => Schema.Union([ValidationFailed, NotFound]),
});

export const markReturned = FunctionSpec.publicMutation({
  name: "markReturned",
  args: () => Schema.Struct({ checkoutSessionId: Schema.String }),
  returns: () => CheckoutResult,
  error: () => Schema.Union([ValidationFailed, NotFound]),
});

export const status = FunctionSpec.publicQuery({
  name: "status",
  args: () =>
    Schema.Struct({
      reportId: Schema.String,
      ownerAccessToken: Schema.String,
    }),
  returns: () =>
    Schema.Struct({
      reportId: Schema.String,
      purchaseStatus: Schema.Literals([
        "missing",
        "created",
        "checkout-open",
        "payment-pending",
        "paid",
        "failed",
        "refunded",
        "disputed",
      ]),
      entitlementStatus: Schema.Literals(["missing", "active", "revoked"]),
      maestroCreditStatus: Schema.Literals([
        "missing",
        "available",
        "applied",
        "revoked",
      ]),
      maestroCreditAmountCents: Schema.optional(Schema.Number),
    }),
  error: () => Schema.Union([Unauthorized, ValidationFailed, NotFound]),
});

export default GroupSpec.make()
  .addFunction(create)
  .addFunction(prepareCheckout)
  .addFunction(persistCheckout)
  .addFunction(markReturned)
  .addFunction(status);
