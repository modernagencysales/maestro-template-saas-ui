import { WorkflowsPage } from '#features/workflows/workflows-page.tsx'
import { createPage } from '#lib/create-page.tsx'

const { Page } = createPage({
  renderComponent: WorkflowsPage,
})

export default Page
