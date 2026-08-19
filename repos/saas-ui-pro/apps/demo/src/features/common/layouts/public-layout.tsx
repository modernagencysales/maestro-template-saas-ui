'use client'

import { AppShell, type AppShellProps } from '#ui/app-shell/app-shell'

/**
 * The default public layout used for unauthenticated pages, like landingspages.
 */
export const PublicLayout: React.FC<AppShellProps> = ({
  children,
  ...rest
}) => {
  return (
    <AppShell h="$100vh" {...rest}>
      {children}
    </AppShell>
  )
}
