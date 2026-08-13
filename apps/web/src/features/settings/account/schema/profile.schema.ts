import * as z from 'zod'

export const profileSchema = z.object({
  id: z.string(),
  name: z.string().min(2, 'Please enter your name').max(40, 'Too long'),
  email: z.string().email(),
  avatar: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  locale: z.string().optional(),
})

export type ProfileFormInput = z.infer<typeof profileSchema>
