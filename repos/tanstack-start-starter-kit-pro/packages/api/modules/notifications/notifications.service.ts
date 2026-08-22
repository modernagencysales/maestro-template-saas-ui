import { z } from 'zod'

import {
  NotificationInsertSchema,
  NotificationMetaData,
  and,
  db,
  eq,
  notifications,
} from '@workspace/db'

export const findNotificationsByUserId = async (args: {
  workspaceId: string
  userId: string
}) => {
  const results = await db.query.notifications.findMany({
    orderBy: { createdAt: 'desc' },
    where: {
      workspaceId: args.workspaceId,
      targetType: 'user',
      targetId: args.userId,
    },
  })

  return results
}

export const findNotificationById = async (args: {
  workspaceId: string
  id: string
}) => {
  return db.query.notifications.findFirst({
    where: { workspaceId: args.workspaceId, id: args.id },
  })
}

export const markNotificationAsRead = async (args: {
  workspaceId: string
  userId: string
  notificationId: string
}) => {
  return db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.workspaceId, args.workspaceId),
        eq(notifications.targetType, 'user'),
        eq(notifications.targetId, args.userId),
      ),
    )
}

export const createNotification = async (
  notification: z.infer<typeof NotificationInsertSchema>,
) => {
  const { metadata, ...rest } = notification

  return db.insert(notifications).values({
    ...rest,
    metadata: metadata as NotificationMetaData,
  })
}
