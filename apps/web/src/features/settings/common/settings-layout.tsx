'use client'

import { AppLayout, AppLayoutProps } from '#features/common/layouts/app-layout'

import { SettingsSidebar } from './settings-sidebar'

/**
 * Settings pages layout
 */
export const SettingsLayout: React.FC<AppLayoutProps> = ({
  children,
  ...rest
}) => {
  return (
    <AppLayout {...rest} sidebar={<SettingsSidebar />}>
      {children}
    </AppLayout>
  )
}
