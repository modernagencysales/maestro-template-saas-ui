import { InferSelectModel } from 'drizzle-orm'
import {
  index,
  json,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { actorTypeEnum, subjectTypeEnum, targetTypeEnum } from '../enums.sql'
import { cuid, timestamps, workspaceId } from '../utils'

export type NotificationMetaData = Record<string, string | number>

export const notifications = pgTable(
  'notification',
  {
    ...workspaceId,
    type: varchar('type', { length: 255 }),
    targetId: cuid('target_id').notNull(),
    targetType: targetTypeEnum('target_type').notNull(),
    actorId: cuid('actor_id'),
    actorType: actorTypeEnum('actor_type').notNull().default('system'),
    subjectId: cuid('subject_id').notNull(),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    metadata: json('data').$type<NotificationMetaData | null>(), // no need to query this, so json type is OK
    readAt: timestamp('readAt'),
    readById: varchar('readBy', { length: 255 }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index().on(t.workspaceId, t.targetType, t.targetId),
  ],
)

export type NotificationModel = InferSelectModel<typeof notifications>
export const NotificationSchema = createSelectSchema(notifications)
export const NotificationInsertSchema = createInsertSchema(notifications)
