import { InferSelectModel } from 'drizzle-orm'
import { json, primaryKey, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { actorTypeEnum, subjectTypeEnum } from '../enums.sql'
import { cuid, timestamps, workspaceId } from '../utils'

export const activityLogs = pgTable(
  'activity_logs',
  {
    ...workspaceId,
    actorId: cuid('actor_id'),
    actorType: actorTypeEnum('actor_type').notNull().default('system'),
    subjectId: varchar('subject_id', { length: 255 }).notNull(),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    metadata: json('meta_data'),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
)

export type ActivityLogModel = InferSelectModel<typeof activityLogs>

export const ActivityLogSchema = createSelectSchema(activityLogs)
export const ActivityLogInsertSchema = createInsertSchema(activityLogs)
