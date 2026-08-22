import { UpdatesPage } from '#features/updates/updates-page.tsx'
import { createPage } from '#lib/create-page.tsx'

const { Page, metadata } = createPage({
  title: 'Updates',
  params: ['workspace', 'id'],
  renderComponent: UpdatesPage,
})

export { metadata }

export default Page
