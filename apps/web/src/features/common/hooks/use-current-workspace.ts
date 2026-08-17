'use client'

import { api } from '#lib/trpc/react'

import { useWorkspaceSlug } from './use-workspace-slug'

export const useCurrentWorkspace = () => {
  const slug = useWorkspaceSlug()

  return api.workspaces.bySlug.useSuspenseQuery(
    { slug },
    {
      retry(failureCount, error) {
        return failureCount < 3 && error.data?.httpStatus !== 404
      },
    },
  )
}
