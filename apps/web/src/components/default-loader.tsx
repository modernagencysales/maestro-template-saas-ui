import { LoadingOverlay as LoadingOverlayBase } from '#components/ui/loading-overlay'

export function DefaultLoader() {
  return (
    <LoadingOverlayBase.Root variant="fullscreen">
      <LoadingOverlayBase.Spinner />
    </LoadingOverlayBase.Root>
  )
}
