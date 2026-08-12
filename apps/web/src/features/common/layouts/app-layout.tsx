"use client";

import type { ComponentProps, ComponentType } from "react";

import { AppShell, AppShellProps, Sidebar } from "@saas-ui/react";

import { PaymentOverdueBanner } from "#features/billing/components/payment-overdue-banner";
import { GlobalSearchInput } from "../components/global-search-input";

export type AppLayoutProps = AppShellProps;

type SaasSidebarProviderProps = ComponentProps<typeof Sidebar.Provider> & {
  variant?: "sidebar" | "inset";
};

// The pinned @saas-ui/react declaration loses the slot-recipe variant even
// though its runtime provider accepts and applies it.
const SaasSidebarProvider =
  Sidebar.Provider as ComponentType<SaasSidebarProviderProps>;

/**
 * Base layout for app pages.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  sidebar,
  ...rest
}) => {
  return (
    <SaasSidebarProvider variant="inset">
      <Sidebar.FlyoutTrigger aria-label="Collapse sidebar" />
      <Sidebar.Trigger
        aria-label="Open sidebar"
        display={{ base: "inline-flex", md: "none" }}
        position="fixed"
        top="4"
        left="4"
        zIndex="docked"
      />

      <AppShell
        sidebar={sidebar}
        header={
          <>
            <PaymentOverdueBanner />
            <GlobalSearchInput aria-label="Search" role="searchbox" />
          </>
        }
        bg="sidebar.bg"
        {...rest}
      >
        <Sidebar.Inset>{children}</Sidebar.Inset>
      </AppShell>

      <Sidebar.Backdrop />
    </SaasSidebarProvider>
  );
};
