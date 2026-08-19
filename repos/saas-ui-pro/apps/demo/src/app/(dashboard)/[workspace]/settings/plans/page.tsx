import { PlansPage } from '#features/settings/pages/plans'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Plans',
  renderComponent: PlansPage,
})

export { metadata }
export default Page
