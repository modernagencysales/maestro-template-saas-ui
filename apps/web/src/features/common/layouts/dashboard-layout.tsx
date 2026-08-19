'use client'

import { AppLayoutProps } from './app-layout'
import { SidebarLayout } from './sidebar-layout'

/**
 * Default dashboard layout.
 */
export const DashboardLayout: React.FC<AppLayoutProps> = ({
  children,
  ...rest
}) => {
  return <SidebarLayout {...rest}>{children}</SidebarLayout>
}
