import React from 'react'

import { useParams } from '@tanstack/react-router'

import {
  getLastUsedWorkspace,
  setLastUsedWorkspace,
} from '#lib/last-used-workspace'

/**
 * Get the current workspace from params
 * The value is stored in a cookie
 *
 * @returns {string} The current workspace slug
 */
export const useWorkspaceSlug = () => {
  const params = useParams({
    from: '/_app/$workspace',
    shouldThrow: false,
  })

  const workspace = params?.workspace?.toString() || ''

  React.useEffect(() => {
    const activeWorkspace = getLastUsedWorkspace()

    if (workspace && workspace !== activeWorkspace) {
      setLastUsedWorkspace(workspace)
    }
  }, [workspace])

  return workspace
}
