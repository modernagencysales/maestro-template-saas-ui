import { env } from 'env'

import { z } from 'zod'

import { SendParams, mailer, render } from '@workspace/email'
import { WorkspaceInviteEmail } from '@workspace/email/workspace-invite'

import { getAccount, getFeatureCounts } from '#modules/billing/billing.service'
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  workspaceProcedure,
} from '#trpc'

import { WorkspaceMemberSettingsSchema } from './workspace-members.schema'
import {
  acceptInvitation,
  getValidatedInvitation,
  getWorkspaceMemberSettings,
  inviteMembers,
  listMembersByWorkspaceId,
  removeMemberFromWorkspace,
  updateRoles,
  upsertWorkspaceMemberSettings,
} from './workspace-members.service'

export const workspaceMembersRouter = createTRPCRouter({
  invitation: publicProcedure
    .input(
      z.object({
        token: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const invitation = await getValidatedInvitation(input.token)

      return {
        token: invitation.id,
        workspace: invitation.workspace,
        invitedBy: invitation.inviter?.name,
      }
    }),

  /**
   * List all members and invites for a workspace
   */
  list: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return listMembersByWorkspaceId(input.workspaceId)
    }),

  /**
   * Invite users to a workspace
   */
  invite: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        emails: z.string().array(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const invitations = await inviteMembers({
        workspaceId: input.workspaceId,
        emails: input.emails,
        invitedBy: ctx.session.user.id,
        role: input.role,
      })

      const emails: SendParams[] = []

      for (const invitation of invitations) {
        const subject = ctx.session.user.name
          ? `${ctx.session.user.name} has invited you to join ${ctx.workspace?.name}`
          : `You have been invited to join ${ctx.workspace?.name}`

        emails.push({
          to: invitation.email,
          subject,
          html: await render(
            WorkspaceInviteEmail({
              token: invitation.id,
              confirmUrl: `${env.APP_URL}/accept-invite/${invitation.id}`,
              workspace: ctx.workspace?.name,
              invitedBy: ctx.session.user.name ?? undefined,
            }),
          ),
        })
      }

      if (emails.length === 0) {
        ctx.logger.debug('No users to invite')
        return
      }

      ctx.logger.debug('Inviting users', emails)

      await mailer.batchSend(emails)

      return true
    }),

  /**
   * Accept an invitation to a workspace
   */
  acceptInvitation: protectedProcedure
    .input(
      z.object({
        token: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const member = await acceptInvitation({
        token: input.token,
        userId: ctx.session.user.id,
      })

      const account = await getAccount(member.workspaceId)

      if (account?.subscription) {
        const counts = await getFeatureCounts({
          accountId: member.workspaceId,
        })

        await ctx.adapters.billing?.updateSubscription?.({
          subscriptionId: account.subscription.id,
          planId: account.subscription.planId,
          counts,
        })
      }
    }),

  /**
   * Remove a member from a workspace
   */
  removeMember: adminProcedure
    .input(
      z.object({
        id: z.string(),
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await removeMemberFromWorkspace(input)

      const account = await getAccount(input.workspaceId)

      if (account?.subscription) {
        const counts = await getFeatureCounts({
          accountId: input.workspaceId,
        })

        await ctx.adapters.billing?.updateSubscription?.({
          subscriptionId: account.subscription.id,
          planId: account.subscription.planId,
          counts,
        })
      }
    }),

  /**
   * Update roles for a user in a workspace
   */
  updateRoles: adminProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
        roles: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      return updateRoles(input)
    }),

  notificationSettings: workspaceProcedure.query(async ({ input, ctx }) => {
    return getWorkspaceMemberSettings({
      userId: ctx.session.user.id,
      workspaceId: input.workspaceId,
    })
  }),

  updateNotificationSettings: workspaceProcedure
    .input(WorkspaceMemberSettingsSchema.omit({ userId: true }))
    .mutation(async ({ input, ctx }) => {
      return upsertWorkspaceMemberSettings({
        userId: ctx.session.user.id,
        ...input,
      })
    }),
})
