import * as Schema from "effect/Schema";
import type { PolicyKindDefinition } from "./types";

export const SpendLimitsPolicy = Schema.Struct({
  dailySpendLimitCents: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  perRunSpendLimitCents: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  currency: Schema.Literal("USD"),
});

export type SpendLimitsPolicy = Schema.Schema.Type<typeof SpendLimitsPolicy>;

export const spendLimitsPolicyKind: PolicyKindDefinition<SpendLimitsPolicy> = {
  kind: "spend.limits",
  schema: SpendLimitsPolicy,
  evalRequired: true,
  merge: (base, override) => ({
    ...base,
    ...override,
  }),
};
