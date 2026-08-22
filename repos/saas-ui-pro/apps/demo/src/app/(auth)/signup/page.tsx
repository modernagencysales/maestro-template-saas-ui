import { SignupPage } from '#features/auth/pages/signup'
import { createPage } from '#lib/create-page'

const { Page, metadata } = createPage({
  title: 'Signup',
  renderComponent: () => {
    return <SignupPage />
  },
})

export { metadata }
export default Page
