import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceSettingsPage } from '#features/settings/workspace/workspace-settings-page'

export const Route = createFileRoute('/_app/$workspace/settings/workspace')({
  head: () => ({
    meta: [
      {
        title: 'Workspace settings',
      },
    ],
  }),
  component: () => <WorkspaceSettingsPage />,
})
