import { Outlet, createFileRoute } from '@tanstack/react-router'

import { DashboardLayout } from '#features/common/layouts/dashboard-layout'

export const Route = createFileRoute('/_app/$workspace/_dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
