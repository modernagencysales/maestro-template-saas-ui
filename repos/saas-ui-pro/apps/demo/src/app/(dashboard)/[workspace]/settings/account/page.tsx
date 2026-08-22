import { AccountProfilePage } from '#features/settings/pages/account/profile.tsx'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Account Settings',
  renderComponent: () => <AccountProfilePage />,
})

export { metadata }
export default Page
