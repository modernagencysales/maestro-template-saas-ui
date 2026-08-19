import { CompaniesPage } from '#features/companies/companies-page.tsx'
import { createPage } from '#lib/create-page.tsx'

const { Page } = createPage({
  renderComponent: CompaniesPage,
})

export default Page
