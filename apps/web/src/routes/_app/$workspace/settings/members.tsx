import { createFileRoute } from '@tanstack/react-router'

import { MembersSettingsPage } from '#features/settings/members/members-page'

export const Route = createFileRoute('/_app/$workspace/settings/members')({
  head: () => ({
    meta: [
      {
        title: 'Manage members',
      },
    ],
  }),
  component: () => <MembersSettingsPage />,
})
