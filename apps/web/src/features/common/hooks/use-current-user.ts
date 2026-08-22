import { api } from '#lib/trpc/react'

export const useCurrentUser = () => {
  return api.auth.me.useSuspenseQuery()
}
