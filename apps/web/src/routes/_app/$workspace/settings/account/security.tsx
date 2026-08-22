import { createFileRoute } from '@tanstack/react-router'

import { AccountSecurityPage } from '#features/settings/account/account-security-page'

export const Route = createFileRoute(
  '/_app/$workspace/settings/account/security',
)({
  head: () => ({
    meta: [
      {
        title: 'Account security',
      },
    ],
  }),
  component: () => <AccountSecurityPage />,
})
