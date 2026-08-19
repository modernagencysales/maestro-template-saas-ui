'use client'

import * as React from 'react'

import { useMutation, useQuery } from '@tanstack/react-query'

import * as Section from '#ui/section/section'
import {
  getOrganization,
  inviteToOrganization,
  removeUserFromOrganization,
  updateMemberRoles,
} from '#api'
import { InviteData } from '#components/invite-dialog'
import { useModals } from '#components/modals'
import { SettingsPage } from '#components/settings-page'
import { useWorkspace } from '#features/common/hooks/use-workspace'
import {
  Member,
  MembersList,
} from '#features/organizations/components/members-list'
import { toast } from '#ui/toaster/toaster'

export function MembersSettingsPage() {
  const slug = useWorkspace()

  const modals = useModals()

  const { data, isLoading } = useQuery({
    queryKey: ['Organization', slug],
    queryFn: () => getOrganization({ slug }),
  })

  const inviteUser = useMutation({
    mutationFn: inviteToOrganization,
  })

  const removeUser = useMutation({
    mutationFn: removeUserFromOrganization,
  })

  const updateRoles = useMutation({
    mutationFn: updateMemberRoles,
  })

  const organization = data?.organization

  if (!isLoading && !organization) {
    return null
  }

  const members =
    organization?.members.map(
      ({ roles, user: { id, email, name, status } }) => {
        return {
          id,
          email,
          name,
          status,
          roles,
        } as Member
      },
    ) || []

  const onInvite = async ({ emails, role }: InviteData) => {
    if (!organization) return

    return toast.promise(
      inviteUser.mutateAsync({
        organizationId: organization.id,
        emails,
        role,
      }),
      {
        loading: {
          title: 'Inviting people...',
          description:
            emails.length === 1
              ? `Inviting ${emails[0]}...`
              : `Inviting ${emails.length} people...`,
        },
        success: {
          title: 'Invitation(s) have been sent.',
          description:
            'The people you invited will receive an email to join your organization.',
        },
        error: (err: Error) => {
          return {
            title: 'Failed to invite people',
            description: err.message,
          }
        },
      },
    )
  }

  const onCancelInvite = async (member: Member) => {
    if (!organization) return

    return toast.promise(
      removeUser.mutateAsync({
        userId: member.id,
        organizationId: organization.id,
      }),
      {
        loading: {
          title: 'Removing member...',
          description: `Removing ${member.email}...`,
        },
        success: {
          title: 'Member removed!',
          description: `Removed ${member.email}!`,
        },
        error: (err: Error) => ({
          title: 'Failed to remove member',
          description: err.message,
        }),
      },
    )
  }

  const onRemove = (member: Member) => {
    if (!organization) return

    modals.confirm?.({
      title: 'Remove member',
      body: `Are you sure you want to remove ${member.email} from ${
        organization.name || 'this organization'
      }?`,
      confirmProps: {
        colorScheme: 'red',
        children: 'Remove',
      },
      onConfirm: async () => {
        await toast.promise(
          removeUser.mutateAsync({
            organizationId: organization.id,
            userId: member.id,
          }),
          {
            loading: {
              title: 'Removing member...',
              description: `Removing ${member.email}...`,
            },
            success: {
              title: 'Member removed!',
              description: `Removed ${member.email}!`,
            },
            error: (err: Error) => ({
              title: 'Failed to remove member',
              description: err.message,
            }),
          },
        )
      },
    })
  }

  const onUpdateRoles = async (member: Member, roles: string[]) => {
    if (!organization) return

    return updateRoles.mutateAsync({
      userId: member.id,
      organizationId: organization.id,
      roles,
    })
  }

  return (
    <SettingsPage
      loading={isLoading}
      title="Members"
      description="Manage who can access your organization"
    >
      <Section.Root>
        <Section.Header title="Members" />
        <Section.Body>
          <MembersList
            members={members}
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
