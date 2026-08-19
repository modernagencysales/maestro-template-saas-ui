import {
  InferInsertModel,
  billingAccounts,
  billingPlans,
  billingSubscriptions,
  createInsertSchema,
} from '@workspace/db'

export type BillingPlanDTO = InferInsertModel<typeof billingPlans>

export type BillingAccountDTO = InferInsertModel<typeof billingAccounts>

export type BillingSubscriptionDTO = InferInsertModel<
  typeof billingSubscriptions
>

export const BillingAccountSchema = createInsertSchema(billingAccounts)

export const UpdateBillingAccountSchema = BillingAccountSchema.pick({
  id: true,
  email: true,
  customerId: true,
})
  .partial({
    email: true,
  })
  .required({
    id: true,
  })
