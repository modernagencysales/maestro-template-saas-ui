import type { Metadata } from 'next'

import { SearchPage } from '#features/search/search-page.tsx'
import { createPage } from '#lib/create-page.tsx'

const { Page } = createPage({
  renderComponent: () => <SearchPage />,
})

export const metadata: Metadata = {
  title: 'Search',
}

export default Page
