import { z } from 'zod'

import { findContactsByIds } from '#modules/contacts/contacts.service'
import { createTRPCRouter, workspaceProcedure } from '#trpc'

import { NotificationDTO } from './notifications.schema'
import {
  findNotificationById,
  findNotificationsByUserId,
  markNotificationAsRead,
} from './notifications.service'

const subjectIdsByType = (
  notifications: Array<NotificationDTO>,
  type: 'contact',
) => {
  return notifications
    .filter((n) => n.subjectType === type)
    .map((n) => n.subjectId)
}

export const notificationsRouter = createTRPCRouter({
  inbox: workspaceProcedure.query(
    async ({ ctx, input }): Promise<{ notifications: NotificationDTO[] }> => {
      const userId = ctx.session.user.id

      const notifications = await findNotificationsByUserId({
        workspaceId: input.workspaceId,
        userId,
      })

      if (!notifications) {
        return {
          notifications: [],
        }
      }

      const contactIds = subjectIdsByType(notifications, 'contact')

      const contacts = await findContactsByIds(contactIds)

      return {
        notifications: notifications.map((n) => ({
          ...n,
          subject:
            n.subjectType === 'contact'
              ? contacts.find((c) => c.id === n.subjectId)
              : undefined,
        })),
      }
    },
  ),
  byId: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const notification = await findNotificationById({
        workspaceId: input.workspaceId,
        id: input.id,
      })

      return notification
    }),
  markAsRead: workspaceProcedure
    .input(
      z.object({
        notificationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      await markNotificationAsRead({
        workspaceId: input.workspaceId,
        userId,
        notificationId: input.notificationId,
      })
    }),
})
