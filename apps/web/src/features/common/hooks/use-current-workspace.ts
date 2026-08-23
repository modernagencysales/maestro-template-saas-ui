'use client'

import { api } from '#lib/trpc/react'
import type { Workspace } from '#lib/trpc/react'

import { useWorkspaceSlug } from './use-workspace-slug'

export const useCurrentWorkspace = () => {
  const slug = useWorkspaceSlug()

  const [workspace, query] = api.workspaces.bySlug.useSuspenseQuery(
    { slug },
    {
      retry(failureCount, error) {
        return failureCount < 3 && error.data?.httpStatus !== 404
      },
    },
  )

  return [requireCurrentWorkspace(workspace), query] as const
}

export const requireCurrentWorkspace = (
  workspace: Workspace | null,
): Workspace => {
  if (!workspace) throw new Error('The current workspace route was not admitted')
  return workspace
}
