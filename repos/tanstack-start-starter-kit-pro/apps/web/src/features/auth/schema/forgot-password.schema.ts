import * as z from 'zod'

export const forgotPasswordSchema = z.object({
  email: z.string().email().describe('Email'),
})

export type ForgotPasswordFormInput = z.infer<typeof forgotPasswordSchema>
