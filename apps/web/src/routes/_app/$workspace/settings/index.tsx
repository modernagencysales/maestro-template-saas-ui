import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/$workspace/settings/')({
  beforeLoad: async ({ params }) => {
    throw redirect({ to: '/$workspace/settings/workspace', params })
  },
})
