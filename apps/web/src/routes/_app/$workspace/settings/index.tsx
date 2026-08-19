import { createFileRoute } from '@tanstack/react-router'

import { SettingsOverviewPage } from '#features/settings/common/settings-overview-page'

export const Route = createFileRoute('/_app/$workspace/settings/')({
  head: () => ({ meta: [{ title: 'Settings overview' }] }),
  component: SettingsOverviewPage,
})
