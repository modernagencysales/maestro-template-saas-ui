import type { ReactNode } from "react";
import { SuiProvider } from "@saas-ui/react";
import { defaultSystem } from "@saas-ui-pro/react";

export function MaestroSaasUiProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <SuiProvider value={defaultSystem}>{children}</SuiProvider>;
}
