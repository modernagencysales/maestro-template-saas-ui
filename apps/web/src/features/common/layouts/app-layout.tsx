"use client";

import * as React from "react";
import type { ComponentProps, ComponentType } from "react";

import {
  AppShell,
  AppShellProps,
  Box,
  IconButton,
  Sidebar,
  useSidebar,
} from "@saas-ui/react";
import { LuPanelLeftOpen } from "react-icons/lu";

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
      <AppLayoutContent sidebar={sidebar} {...rest}>
        {children}
      </AppLayoutContent>
    </SaasSidebarProvider>
  );
};

const AppLayoutContent: React.FC<AppLayoutProps> = ({
  children,
  sidebar,
  ...rest
}) => {
  const { isMobile, open, setOpen } = useSidebar();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isMobile && wasOpenRef.current && !open) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [isMobile, open]);

  React.useEffect(() => {
    if (!isMobile || !open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, open, setOpen]);

  return (
    <>
      <Sidebar.FlyoutTrigger aria-label="Collapse sidebar" />
      <Sidebar.Trigger asChild>
        <IconButton
          ref={triggerRef}
          aria-label="Open sidebar"
          variant="ghost"
          display={{ base: "inline-flex", md: "none" }}
          position="fixed"
          top="4"
          left="4"
          zIndex="docked"
        >
          <LuPanelLeftOpen />
        </IconButton>
      </Sidebar.Trigger>

      <AppShell
        sidebar={sidebar}
        header={
          <>
            <PaymentOverdueBanner />
            <Box ps={{ base: "14", md: "0" }}>
              <GlobalSearchInput aria-label="Search" role="searchbox" />
            </Box>
          </>
        }
        bg="sidebar.bg"
        {...rest}
      >
        <Sidebar.Inset pt={{ base: "14", md: "0" }}>{children}</Sidebar.Inset>
      </AppShell>

      <Sidebar.Backdrop data-testid="sidebar-backdrop" />
    </>
  );
};
