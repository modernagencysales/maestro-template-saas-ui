import { createFileRoute } from '@tanstack/react-router'

import { productShell } from '#config/product-shell'
import { ConnectionsPage } from '#features/connections/connections-page'
import { ReportsPage } from '#features/reports/reports-page.tsx'

export const Route = createFileRoute('/_app/$workspace/_dashboard/')({
  head: () => ({
    meta: [
      {
        title:
          productShell.dashboard === 'connections' ? 'Connections' : 'Reports',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return productShell.dashboard === 'connections' ? (
    <ConnectionsPage />
  ) : (
    <ReportsPage />
  )
}
