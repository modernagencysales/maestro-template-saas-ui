import { AccountSecurityPage } from '#features/settings/pages/account/security.tsx'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Security',
  renderComponent: AccountSecurityPage,
})

export { metadata }
export default Page
