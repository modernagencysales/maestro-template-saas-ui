import { InferSelectModel } from 'drizzle-orm'
import { char, primaryKey, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { timestamps } from '../utils'
import { workspaces } from '../workspaces/workspaces.sql'

export const tags = pgTable(
  'tags',
  {
    id: varchar('id', { length: 40 }).notNull(),
    workspaceId: char('workspace_id', { length: 24 })
      .references(() => workspaces.id)
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    color: varchar('color', { length: 255 }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.id] })],
)

export type TagModel = InferSelectModel<typeof tags>
export const TagSchema = createSelectSchema(tags)
export const TagInsertSchema = createInsertSchema(tags)
