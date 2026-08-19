import { useQuery } from '@tanstack/react-query'

import { getCurrentUser } from '#api'

export const useCurrentUser = () => {
  const { data } = useQuery({
    queryKey: ['CurrentUser'],
    queryFn: getCurrentUser,
  })
  return data?.currentUser
}
