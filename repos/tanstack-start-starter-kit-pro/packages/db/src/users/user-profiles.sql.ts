import { InferSelectModel } from 'drizzle-orm'
import { varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { timestamps, userId } from '../utils'

export const userProfiles = pgTable('user_profiles', {
  id: userId('id').primaryKey().notNull(),
  locale: varchar('locale', { length: 10 }),
  ...timestamps,
})

export type UserProfileModel = InferSelectModel<typeof userProfiles>
export const UserProfileSchema = createSelectSchema(userProfiles)
export const UserProfileInsertSchema = createInsertSchema(userProfiles)
