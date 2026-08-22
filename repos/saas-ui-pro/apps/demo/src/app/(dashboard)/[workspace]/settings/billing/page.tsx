import { BillingPage } from '#features/settings/pages/billing'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Billing',
  renderComponent: BillingPage,
})

export { metadata }
export default Page
