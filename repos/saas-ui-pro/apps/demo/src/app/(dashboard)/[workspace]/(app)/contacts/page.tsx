import { ContactsListPage } from '#features/contacts/list-page'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Contacts',
  renderComponent: ContactsListPage,
})

export { metadata }
export default Page
