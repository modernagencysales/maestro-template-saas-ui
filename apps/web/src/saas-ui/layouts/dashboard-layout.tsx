import type { ReactNode } from "react";
import { AppSidebar } from "../components/app-sidebar";
import { AppLayout } from "./app-layout";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/layouts/dashboard-layout.tsx.
export function DashboardLayout({
  activeKey,
  children,
}: {
  readonly activeKey: Parameters<typeof AppSidebar>[0]["activeKey"];
  readonly children: ReactNode;
}) {
  return (
    <AppLayout sidebar={<AppSidebar activeKey={activeKey} />}>
      {children}
    </AppLayout>
  );
}
