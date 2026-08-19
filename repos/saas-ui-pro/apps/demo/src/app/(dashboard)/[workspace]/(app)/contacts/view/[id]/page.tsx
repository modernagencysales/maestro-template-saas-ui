import { ContactsViewPage } from '#features/contacts/view-page.tsx'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  params: ['workspace', 'id'],
  title: 'Contact',
  renderComponent: ContactsViewPage,
})

export { metadata }
export default Page
