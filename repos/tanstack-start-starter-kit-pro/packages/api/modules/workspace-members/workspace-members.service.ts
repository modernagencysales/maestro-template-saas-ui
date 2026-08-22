import { env } from 'env'

import { z } from 'zod'

import { and, db, eq, workspaceMembers } from '@workspace/db'
import { workspaceInvitations, workspaceMemberSettings } from '@workspace/db'

import { throwIfLimitReached } from '#modules/billing/billing.service'
import { ServiceError } from '#utils/error'

import { WorkspaceMemberStatus } from '../workspaces/workspaces.schema'
import { WorkspaceMemberSettingsSchema } from './workspace-members.schema'

export const listMembersByWorkspaceId = async (id: string) => {
  const members = await db.query.workspaceMembers.findMany({
    where: { workspaceId: id },
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          image: true,
          name: true,
        },
      },
    },
    columns: {
      userId: true,
      role: true,
      status: true,
    },
  })

  const invites = await db.query.workspaceInvitations.findMany({
    where: { workspaceId: id, accepted: false },
    columns: {
      id: true,
      userId: true,
      email: true,
      role: true,
    },
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          image: true,
          name: true,
        },
      },
    },
  })

  const invitees = invites.map((invite) => {
    return {
      ...(invite.user ?? { id: invite.id, email: invite.email }),
      status: 'invited' as WorkspaceMemberStatus,
      roles: [invite.role],
    }
  })

  return [
    ...members.flatMap((member) =>
      member.user
        ? [
            {
              id: member.user.id,
              email: member.user.email,
              avatar: member.user.image,
              name: member.user.name,
              status: member.status,
              roles: [member.role],
            },
          ]
        : [],
    ),
    ...invitees,
  ]
}

export const getWorkspaceMemberById = async (args: {
  userId: string
  workspaceId: string
}) => {
  return await db.query.workspaceMembers.findFirst({
    where: { userId: args.userId, workspaceId: args.workspaceId },
    columns: {
      role: true,
      status: true,
      workspaceId: true,
      userId: true,
    },
    with: {
      workspace: {
        columns: {
          id: true,
          ownerId: true,
          slug: true,
          name: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          subscription: {
            columns: {
              id: true,
              planId: true,
              status: true,
              startedAt: true,
              canceledAt: true,
              trialEndsAt: true,
              cancelAtPeriodEnd: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  })
}

export const getInvitation = async (id: string) => {
  return await db.query.workspaceInvitations.findFirst({
    where: { id },
    with: {
      workspace: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      inviter: {
        columns: {
          name: true,
        },
      },
    },
  })
}

export const getValidatedInvitation = async (id: string) => {
  const invitation = await getInvitation(id)

  if (!invitation) {
    throw new ServiceError(
      'invitation.not_found',
      'The provided token is invalid',
    )
  }

  if (invitation.accepted) {
    throw new ServiceError(
      'invitation.already_accepted',
      'The provided token has already been accepted',
    )
  }

  const expiresAt = invitation.expiresAt?.getTime()

  if (expiresAt && expiresAt < Date.now()) {
    throw new ServiceError(
      'invitation.expired',
      'The provided token is expired',
    )
  }

  return invitation
}

export const inviteMembers = async (args: {
  workspaceId: string
  emails: string[]
  role?: string
  invitedBy?: string
}) => {
  const workspace = await db.query.workspaces.findFirst({
    where: { id: args.workspaceId },
    columns: {
      id: true,
      ownerId: true,
    },
    with: {
      subscription: {
        columns: {
          id: true,
          planId: true,
        },
      },
      members: {
        columns: {
          userId: true,
        },
      },
    },
  })

  if (!workspace) {
    throw new ServiceError(
      'workspace.not_found',
      `Could not find workspace with id ${args.workspaceId}`,
    )
  }

  const memberCount = workspace.members.length + args.emails.length

  const planId = workspace.subscription?.planId ?? env.DEFAULT_PLAN_ID
  if (planId) {
    await throwIfLimitReached({
      planId,
      featureId: 'users',
      quantity: memberCount,
    })
  }

  const existingUsers = await db.query.users.findMany({
    where: { email: { in: args.emails } },
    columns: {
      id: true,
      email: true,
    },
  })

  const members = existingUsers?.length
    ? await db.query.workspaceMembers.findMany({
        where: {
          workspaceId: workspace.id,
          userId: { in: existingUsers.map((user) => user.id) },
        },
        columns: {
          userId: true,
        },
      })
    : []

  const memberIds = members.map((member) => member.userId)

  const newUsers = existingUsers.filter(({ id }) => !memberIds.includes(id))
  const newEmails = args.emails.filter(
    (email) => !existingUsers.find((user) => user.email === email),
  )

  const params = {
    workspaceId: workspace.id,
    role: args.role ?? 'member',
    status: 'invited',
    invitedBy: args.invitedBy,
    userId: undefined,
  }

  const values = newUsers
    .map<any>((user) => ({
      ...params,
      userId: user.id,
      email: user.email ?? undefined,
    }))
    .concat(
      newEmails.map((email) => ({
        ...params,
        email,
        userId: undefined,
      })),
    )

  if (!values.length) {
    return []
  }

  return await db
    .insert(workspaceInvitations)
    .values(values)
    .onConflictDoNothing()
    .returning()
    .execute()
}

export const acceptInvitation = async (args: {
  token: string
  userId: string
}) => {
  const invite = await getValidatedInvitation(args.token)

  if (invite.userId && invite.userId !== args.userId) {
    throw new ServiceError(
      'invitation.user_mismatch',
      'The provided token does not match the user',
    )
  }

  return db.transaction(async (tx) => {
    const result = await tx
      .insert(workspaceMembers)
      .values({
        userId: args.userId,
        workspaceId: invite.workspaceId,
        role: invite.role ?? 'member',
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.userId, workspaceMembers.workspaceId],
        set: {
          role: invite.role ?? 'member',
          status: 'active',
        },
      })
      .returning()
      .execute()

    await tx
      .delete(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invite.id))
      .execute()

    return result[0]
  })
}

export const removeMemberFromWorkspace = async (args: {
  workspaceId: string
  id: string
}) => {
  return db.transaction(async (tx) => {
    const member = await tx.query.workspaceMembers.findFirst({
      where: { workspaceId: args.workspaceId, userId: args.id },
    })

    if (!member) {
      await tx
        .delete(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, args.workspaceId),
            eq(workspaceInvitations.id, args.id),
          ),
        )

      return
    }

    await tx
      .update(workspaceMembers)
      .set({
        status: 'suspended',
      })
      .where(
        and(
          eq(workspaceMembers.workspaceId, args.workspaceId),
          eq(workspaceMembers.userId, args.id),
        ),
      )
  })
}

export const updateRoles = async (args: {
  workspaceId: string
  userId: string
  roles: string[]
}) => {
  return db
    .update(workspaceMembers)
    .set({
      role: args.roles[0],
    })
    .where(
      and(
        eq(workspaceMembers.userId, args.userId),
        eq(workspaceMembers.workspaceId, args.workspaceId),
      ),
    )
}

export const getWorkspaceMemberSettings = async (args: {
  userId: string
  workspaceId: string
}) => {
  return db.query.workspaceMemberSettings.findFirst({
    where: { userId: args.userId, workspaceId: args.workspaceId },
  })
}

export const upsertWorkspaceMemberSettings = async (
  args: z.infer<typeof WorkspaceMemberSettingsSchema>,
) => {
  const { workspaceId, userId, ...$set } = args
  return db
    .insert(workspaceMemberSettings)
    .values({
      userId,
      workspaceId,
      ...$set,
    })
    .onConflictDoUpdate({
      target: [
        workspaceMemberSettings.userId,
        workspaceMemberSettings.workspaceId,
      ],
      set: $set,
    })
}
