import { LoadingOverlay as LoadingOverlayBase } from "@saas-ui/react";

export function DefaultLoader() {
  return (
    <LoadingOverlayBase.Root>
      <LoadingOverlayBase.Spinner />
    </LoadingOverlayBase.Root>
  );
}
