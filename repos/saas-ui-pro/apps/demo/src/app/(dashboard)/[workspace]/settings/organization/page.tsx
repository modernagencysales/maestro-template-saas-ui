import { OrganizationSettingsPage } from '#features/settings/pages/organization'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Organization Settings',
  renderComponent: OrganizationSettingsPage,
})

export { metadata }
export default Page
