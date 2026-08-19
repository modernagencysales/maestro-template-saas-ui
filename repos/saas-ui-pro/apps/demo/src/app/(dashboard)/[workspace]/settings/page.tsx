import { SettingsOverviewPage } from '#features/settings/pages/overview'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Organization Settings',
  renderComponent: SettingsOverviewPage,
})

export { metadata }
export default Page
