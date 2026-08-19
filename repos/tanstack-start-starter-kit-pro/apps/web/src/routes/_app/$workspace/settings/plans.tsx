import { createFileRoute } from '@tanstack/react-router'

import { PlansPage } from '#features/settings/billing/plans-page'

export const Route = createFileRoute('/_app/$workspace/settings/plans')({
  head: () => ({
    meta: [
      {
        title: 'Billing plans',
      },
    ],
  }),
  component: () => <PlansPage />,
})
