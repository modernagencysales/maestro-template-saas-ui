import { ReportsPage } from '#features/reports/reports-page'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Reports',
  renderComponent: () => <ReportsPage />,
})

export { metadata }
export default Page
