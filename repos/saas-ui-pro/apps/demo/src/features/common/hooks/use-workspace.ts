import React from 'react'

import { useLocalStorage } from '@saas-ui/hooks'
import { useParams } from 'next/navigation'

/**
 * Get the current workspace from localStorage if available.
 * The value is synced with the query params.
 *
 * @returns {string} The current workspace
 */
export const useWorkspace = () => {
  const params = useParams()
  const workspace = params.workspace?.toString() || ''

  const [activeWorkspace, setWorkspace] = useLocalStorage(
    'app.workspace',
    workspace,
  )

  React.useEffect(() => {
    if (workspace && workspace !== activeWorkspace) {
      setWorkspace(workspace)
    }
  }, [params])

  return activeWorkspace
}
