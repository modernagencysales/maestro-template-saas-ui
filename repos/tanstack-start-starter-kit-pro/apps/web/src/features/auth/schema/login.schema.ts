import { z } from 'zod'

import { passwordSchema } from './password.schema'

export const loginSchema = z.object({
  email: z.string().email().describe('Email'),
  password: passwordSchema.shape.password.describe('Password'),
})

export type LoginFormInput = z.infer<typeof loginSchema>
