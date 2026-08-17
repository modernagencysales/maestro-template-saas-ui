import { Outlet, createFileRoute } from '@tanstack/react-router'

import { FullscreenLayout } from '#features/common/layouts/fullscreen-layout'

export const Route = createFileRoute('/_app/getting-started')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <FullscreenLayout>
      <Outlet />
    </FullscreenLayout>
  )
}
