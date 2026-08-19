import { GettingStartedPage } from '#features/getting-started/getting-started-page'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Getting started',
  renderComponent: () => {
    return <GettingStartedPage />
  },
})

export { metadata }
export default Page
