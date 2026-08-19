import { createFileRoute } from '@tanstack/react-router'

import { ReportsPage } from '#features/reports/reports-page.tsx'

export const Route = createFileRoute('/_app/$workspace/_dashboard/')({
  head: () => ({
    meta: [
      {
        title: 'Reports',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <ReportsPage />
}
