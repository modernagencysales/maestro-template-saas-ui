import { InferSelectModel } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { users } from '../auth/auth.sql'

export { users }

export type UserModel = InferSelectModel<typeof users>
export const UserSchema = createSelectSchema(users)
export const UserInsertSchema = createInsertSchema(users)
