import { createFileRoute } from '@tanstack/react-router'

import { TagsSettingsPage } from '#features/settings/tags/tags-settings-page'

export const Route = createFileRoute('/_app/$workspace/settings/tags')({
  head: () => ({
    meta: [
      {
        title: 'Manage tags',
      },
    ],
  }),
  component: () => <TagsSettingsPage />,
})
