import { ClientOnly } from "@saas-ui/react";
import type { ResizerProps } from "@saas-ui-pro/react";
import { Resizer } from "@saas-ui-pro/react";

export function ClientResizer(props: ResizerProps) {
  const { children } = props;
  return (
    <ClientOnly fallback={children}>
      <Resizer {...props}>{children}</Resizer>
    </ClientOnly>
  );
}
