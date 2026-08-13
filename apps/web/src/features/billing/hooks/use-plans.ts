import { api } from '#lib/trpc/react'

export const usePlans = () => {
  return api.billing.plans.useQuery()
}
