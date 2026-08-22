import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/$workspace/settings/account/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$workspace/settings/account/profile', params })
  },
})
