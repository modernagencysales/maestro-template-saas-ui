import { LoadingOverlay as LoadingOverlayBase } from "@saas-ui/react";

export function DefaultLoader() {
  return (
    <LoadingOverlayBase.Root variant="fullscreen">
      <LoadingOverlayBase.Spinner />
    </LoadingOverlayBase.Root>
  );
}
