'use client'

import * as Sidebar from '#ui/sidebar/sidebar'
import { SettingsSidebar } from '#features/settings/components/sidebar'

import { AppLayout, AppLayoutProps } from './app-layout'

/**
 * Settings pages layout
 */
export const SettingsLayout: React.FC<AppLayoutProps> = ({
  children,
  ...rest
}) => {
  return (
    <Sidebar.Provider>
      <AppLayout {...rest} sidebar={<SettingsSidebar />}>
        {children}
      </AppLayout>
    </Sidebar.Provider>
  )
}
