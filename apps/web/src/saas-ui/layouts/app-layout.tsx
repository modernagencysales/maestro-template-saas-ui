import type { ReactElement, ReactNode } from "react";
import { AppShell, Sidebar } from "@saas-ui/react";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/layouts/app-layout.tsx.
export function AppLayout({
  children,
  sidebar,
}: {
  readonly children: ReactNode;
  readonly sidebar?: ReactElement;
}) {
  return (
    <Sidebar.Provider>
      <Sidebar.FlyoutTrigger />
      <AppShell bg="sidebar.bg" minH="100dvh" sidebar={sidebar}>
        <Sidebar.Inset minW="0">{children}</Sidebar.Inset>
      </AppShell>
      <Sidebar.Backdrop />
    </Sidebar.Provider>
  );
}
