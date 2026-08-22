import { Outlet, createFileRoute } from '@tanstack/react-router'

import { SettingsLayout } from '#features/settings/common/settings-layout'

export const Route = createFileRoute('/_app/$workspace/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  )
}
