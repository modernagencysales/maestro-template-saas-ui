import { z } from 'zod'

import { createInsertSchema, userProfiles, users } from '@workspace/db'

export const CreateUserProfileSchema = createInsertSchema(userProfiles)

export const UpdateUserProfileSchema = createInsertSchema(userProfiles)

export type UserProfileDTO = z.infer<typeof CreateUserProfileSchema>

export const CreateUserSchema = createInsertSchema(users)

export const UpdateUserSchema = createInsertSchema(users)

type CreateUser = z.infer<typeof CreateUserSchema>

export interface UserDTO extends Pick<
  CreateUser,
  'id' | 'name' | 'email' | 'createdAt' | 'updatedAt'
> {
  id: string
  avatar?: string | null
}
