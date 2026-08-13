'use client'

import { Alert } from '@chakra-ui/react'
import { useLimitReached } from '@saas-ui-pro/billing'
import { Section, toast } from '@saas-ui/react'

import { WorkspaceMemberDTO } from '@workspace/api/types'
import type { InviteData } from '@workspace/ui/invite-dialog'
import { useModals } from '@workspace/ui/modals'
import { SettingsPage } from '@workspace/ui/settings-page'

import { Link } from '#components/link'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { api } from '#lib/trpc/react'

import { Member, MembersList } from './members-list'

export function MembersSettingsPage() {
  const modals = useModals()

  const [workspace] = useCurrentWorkspace()

  const { data } = api.workspaceMembers.list.useQuery({
    workspaceId: workspace.id,
  })

  const members = data ?? []

  const limitReached = useLimitReached('users', members.length)

  const utils = api.useUtils()

  const inviteMembers = api.workspaceMembers.invite.useMutation({
    onSuccess() {
      utils.workspaceMembers.list.invalidate()
    },
  })

  const removeMember = api.workspaceMembers.removeMember.useMutation({
    onSuccess() {
      utils.workspaceMembers.list.invalidate()
    },
  })

  const updateRoles = api.workspaceMembers.updateRoles.useMutation({
    onSuccess() {
      utils.workspaceMembers.list.invalidate()
    },
  })

  const onInvite = async ({ emails, role }: InviteData) => {
    return toast.promise(
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
        success: {
          title: `Invitation(s) have been sent.`,
        },
        error: (err: any) => {
          return {
            title: 'Failed to invite members',
            description: err.message,
          }
        },
      },
    )
  }

  const onCancelInvite = async (member: Member) => {
    return toast.promise(
      removeMember.mutateAsync({
        id: member.id,
        workspaceId: workspace.id,
      }),
      {
        loading: {
          title: `Removing ${member.email}...`,
        },
        success: {
          title: `Removed ${member.email}!`,
        },
        error: (err: any) => {
          return {
            title: 'Failed to remove member',
            description: err.message,
          }
        },
      },
    )
  }

  const onRemove = (member: WorkspaceMemberDTO) => {
    modals.confirm?.({
      title: 'Remove member',
      body: `Are you sure you want to remove ${member.email} from ${
        workspace.name || 'this workspace'
      }?`,
      confirmProps: {
        colorScheme: 'red',
        children: 'Remove',
      },
      onConfirm: async () => {
        await toast.promise(
          removeMember.mutateAsync({
            workspaceId: workspace.id,
            id: member.id,
          }),
          {
            loading: {
              title: `Removing ${member.email}...`,
            },
            success: {
              title: `Removed ${member.email}!`,
            },
            error: (err: any) => {
              return {
                title: 'Failed to remove member',
                description: err.message,
              }
            },
          },
        )
      },
    })
  }

  const onUpdateRoles = async (member: Member, roles: string[]) => {
    return updateRoles.mutateAsync({
      userId: member.id,
      workspaceId: workspace.id,
      roles,
    })
  }

  return (
    <SettingsPage
      title="Members"
      description="Manage who can access your workspace"
    >
      <Section.Root>
        <Section.Header title="Members" />
        <Section.Body>
          {limitReached ? (
            <Alert.Root colorPalette="primary" mb="4">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  You have reached the limit of members for your current plan.
                </Alert.Title>
                <Alert.Description>
                  Please upgrade your plan to invite more people.{' '}
                </Alert.Description>
              </Alert.Content>
              <Link
                to="/$workspace/settings/plans"
                params={{ workspace: workspace.slug }}
                fontWeight="medium"
              >
                Upgrade now
              </Link>
            </Alert.Root>
          ) : null}
          <MembersList
            allowInvite={!limitReached}
            members={members.map((member) => ({
              id: member.id,
              email: member.email!,
              roles: member.roles,
              status: member.status,
            }))}
            onInvite={onInvite}
            onCancelInvite={onCancelInvite}
            onRemove={onRemove}
            onUpdateRoles={onUpdateRoles}
          />
        </Section.Body>
      </Section.Root>
    </SettingsPage>
  )
}
