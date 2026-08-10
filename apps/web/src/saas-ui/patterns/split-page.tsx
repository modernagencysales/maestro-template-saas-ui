import type { ReactElement } from "react";
import { SplitPage as ProSplitPage } from "@saas-ui-pro/react";

// Adapted from the pinned starter contacts/inbox/inbox-layout.tsx.
export function SplitPage({
  detail,
  list,
  onOpenChange,
  open,
}: {
  readonly detail: ReactElement;
  readonly list: ReactElement;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open: boolean;
}) {
  return (
    <ProSplitPage
      onClose={() => onOpenChange?.(false)}
      onOpen={() => onOpenChange?.(true)}
      open={open}
    >
      {[list, detail]}
    </ProSplitPage>
  );
}
