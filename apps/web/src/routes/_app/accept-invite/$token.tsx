import { createFileRoute } from '@tanstack/react-router'

import { AcceptInvitePage } from '#features/workspaces/invite/accept-invite-page'

export const Route = createFileRoute('/_app/accept-invite/$token')({
  head: () => ({
    meta: [
      {
        title: 'Accept invitation',
      },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <AcceptInvitePage params={Route.useParams()} />;
}
