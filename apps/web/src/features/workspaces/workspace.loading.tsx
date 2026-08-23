import { LoadingOverlay } from '#components/ui/loading-overlay'

export function WorkspaceLoading() {
  return (
    <LoadingOverlay.Root variant="fullscreen">
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  )
}
