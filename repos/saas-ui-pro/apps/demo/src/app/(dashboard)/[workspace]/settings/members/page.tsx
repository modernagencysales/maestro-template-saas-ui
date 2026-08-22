import { MembersSettingsPage } from '#features/settings/pages/members'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Members',
  renderComponent: MembersSettingsPage,
})

export { metadata }
export default Page
