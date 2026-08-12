import { LoadingOverlay } from "@saas-ui/react";

export function WorkspaceLoading() {
  return (
    <LoadingOverlay.Root>
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  );
}
