import { getNotifications } from '#api'
import { createPage } from '#lib/create-page.tsx'

const { Page } = createPage({
  params: ['workspace'],
  loader: async ({ queryClient }) => {
    queryClient.ensureQueryData({
      queryKey: ['Notifications'],
      queryFn: () => {
        return getNotifications()
      },
    })
  },
  renderComponent: () => null,
})

export default Page
