import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/$workspace/_dashboard/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$workspace/updates',
      params: { workspace: params.workspace },
    })
  },
})
