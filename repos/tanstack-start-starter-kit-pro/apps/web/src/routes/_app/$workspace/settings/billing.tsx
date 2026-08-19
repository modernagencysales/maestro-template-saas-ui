import { createFileRoute } from '@tanstack/react-router'

import { BillingPage } from '#features/settings/billing/billing-page'

export const Route = createFileRoute('/_app/$workspace/settings/billing')({
  head: () => ({
    meta: [
      {
        title: 'Billing',
      },
    ],
  }),
  component: () => <BillingPage />,
})
