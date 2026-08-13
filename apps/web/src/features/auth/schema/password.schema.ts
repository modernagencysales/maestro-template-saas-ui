import { z } from 'zod'

export const passwordSchema = z.object({
  password: z.string().min(8).max(32),
})

export type PasswordFormInput = z.infer<typeof passwordSchema>
