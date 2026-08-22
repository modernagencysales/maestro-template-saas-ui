import { AccountNotificationsPage } from '#features/settings/pages/account/notifications.tsx'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Notifications',
  renderComponent: AccountNotificationsPage,
})

export { metadata }
export default Page
