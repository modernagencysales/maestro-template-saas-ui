import * as z from 'zod'

export const appearanceSchema = z.object({})
export type AppearanceFormInput = z.infer<typeof appearanceSchema>
