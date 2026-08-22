import { LoginPage } from '#features/auth/pages/login'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Login',
  renderComponent: () => {
    return <LoginPage />
  },
})

export { metadata }

export default Page
