import * as z from 'zod'

export const subscribeSchema = z.object({
  newsletter: z.boolean(),
})

export type SubscribeFormInput = z.infer<typeof subscribeSchema>
