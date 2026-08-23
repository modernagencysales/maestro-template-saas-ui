'use client'

import { AppShell, AppShellProps } from '@saas-ui/react'

import { Sidebar } from '#components/ui/sidebar'

import { PaymentOverdueBanner } from '#features/billing/components/payment-overdue-banner'

export interface AppLayoutProps extends AppShellProps {}

/**
 * Base layout for app pages.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  sidebar,
  ...rest
}) => {
  return (
    <Sidebar.Provider variant="inset">
      <Sidebar.FlyoutTrigger />

      <AppShell
        sidebar={sidebar}
        header={<PaymentOverdueBanner />}
        bg="sidebar.bg"
        {...rest}
      >
        <Sidebar.Inset>{children}</Sidebar.Inset>
      </AppShell>

      <Sidebar.Backdrop />
    </Sidebar.Provider>
  )
}
