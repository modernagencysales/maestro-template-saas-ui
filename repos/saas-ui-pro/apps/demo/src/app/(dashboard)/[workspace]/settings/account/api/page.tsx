import { AccountApiPage } from '#features/settings/pages/account/api.tsx'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'API',
  renderComponent: AccountApiPage,
})

export { metadata }
export default Page
