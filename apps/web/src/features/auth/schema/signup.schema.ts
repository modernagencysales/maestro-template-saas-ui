import { z } from 'zod'

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type SignupFormInput = z.infer<typeof signupSchema>
