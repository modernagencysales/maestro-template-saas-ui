import { LoadingOverlay, LoadingSpinner } from '@saas-ui/react'

export function WorkspaceLoading() {
  return (
    <LoadingOverlay variant="fullscreen">
      <LoadingSpinner />
    </LoadingOverlay>
  )
}
