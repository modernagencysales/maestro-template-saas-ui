'use client'

import * as Sidebar from '#ui/sidebar/sidebar'
import { AppShell, type AppShellProps } from '#ui/app-shell/app-shell'

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
    <AppShell h="$100vh" sidebar={sidebar} {...rest}>
      {children}
    </AppShell>
  )
}
