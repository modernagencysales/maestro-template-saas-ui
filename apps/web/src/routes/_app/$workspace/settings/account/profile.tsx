import { createFileRoute } from '@tanstack/react-router'

import { AccountProfilePage } from '#features/settings/account/account-profile-page'

export const Route = createFileRoute(
  '/_app/$workspace/settings/account/profile',
)({
  head: () => ({
    meta: [
      {
        title: 'Profile',
      },
    ],
  }),
  component: () => <AccountProfilePage />,
})
