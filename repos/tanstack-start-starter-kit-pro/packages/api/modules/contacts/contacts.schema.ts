import { z } from 'zod'

import { contacts, createInsertSchema, createSelectSchema } from '@workspace/db'

export const ContactSchema = createSelectSchema(contacts)
export const ContactInsertSchema = createInsertSchema(contacts)

export interface ContactDTO extends Omit<
  z.infer<typeof ContactSchema>,
  'tags'
> {
  tags?: string[] | null
}

export const CreateContactInputSchema = ContactInsertSchema.omit({
  tags: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  updatedAt: true,
})
  .partial({
    id: true,
    sortOrder: true,
  })
  .and(z.object({ tags: z.string().array().optional() }))

export type CreateContactDTO = z.infer<typeof CreateContactInputSchema>

export const UpdateContactInputSchema = ContactInsertSchema.omit({
  id: true,
  firstName: true,
  lastName: true,
  tags: true,
  email: true,
  type: true,
  createdAt: true,
  updatedAt: true,
})
  .partial()
  .and(
    z.object({
      id: z.string(),
      tags: z.string().array().optional(),
      avatar: z.string().optional(),
    }),
  )

export type UpdateContactDTO = z.infer<typeof UpdateContactInputSchema>
