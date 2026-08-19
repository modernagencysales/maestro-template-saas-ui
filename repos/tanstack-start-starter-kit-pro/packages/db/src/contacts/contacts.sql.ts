import { InferSelectModel } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  real,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { timestamps, workspaceId } from '../utils'

export const contactStatusEnum = pgEnum('contact_status', [
  'new',
  'active',
  'inactive',
])

export const contactTypeEnum = pgEnum('contact_type', ['lead', 'customer'])

export const contacts = pgTable(
  'contacts',
  {
    ...workspaceId,
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    name: varchar('name', { length: 255 }),
    avatar: varchar('avatar', { length: 255 }),
    status: contactStatusEnum('status').notNull().default('new'),
    type: contactTypeEnum('type').notNull(),
    tags: jsonb('tags').$type<string[]>(),
    sortOrder: real('sort_order'),
    ...timestamps,
  },
  (t) => [index().on(t.workspaceId, t.id), unique().on(t.workspaceId, t.email)],
)

export type ContactModel = InferSelectModel<typeof contacts>
export const ContactSchema = createSelectSchema(contacts)
export const ContactInsertSchema = createInsertSchema(contacts)
