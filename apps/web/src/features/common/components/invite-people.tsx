import { toast } from '@saas-ui/react'

import { InviteDialog } from '@workspace/ui/invite-dialog'

import { api, isTRPCClientError } from '#lib/trpc/react'

import { useCurrentWorkspace } from '../hooks/use-current-workspace'

export function InvitePeopleDialog(props: {
  isOpen: boolean
  onClose: () => void
}) {
  const [workspace] = useCurrentWorkspace()

  const inviteMembers = api.workspaceMembers.invite.useMutation()

  return (
    <InviteDialog
      {...props}
      onInvite={async ({ emails, role }) => {
        const result = await toast.promise(
          inviteMembers.mutateAsync({
            workspaceId: workspace.id,
            emails,
            role,
          }),
          {
            loading: {
              title:
                emails.length === 1
                  ? `Inviting ${emails[0]}...`
                  : `Inviting ${emails.length} people...`,
            },

            success: () => {
              return {
                title: 'Invitation(s) have been sent.',
              }
            },
            error: (error: unknown) => {
              if (isTRPCClientError(error)) {
                console.error(error.data)
              }

              return {
                title:
                  error instanceof Error ? error.message : 'Invitation failed',
              }
            },
          },
        )

        if (!result) {
          throw new Error('Failed to invite people')
        }
      }}
    />
  )
}
