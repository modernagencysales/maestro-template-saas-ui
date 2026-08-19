import { z } from 'zod'

import { createInsertSchema, workspaceMemberSettings } from '@workspace/db'

export const NewslettersSchema = z.object({
  product_updates: z.boolean().optional(),
  important_updates: z.boolean().optional(),
})

export const NotificationChannelsSchema = z.object({
  email: z.boolean().optional(),
  desktop: z.boolean().optional(),
})

export const NotificationTopicsSchema = z.object({
  contacts_new_lead: z.boolean().optional(),
  contacts_account_upgraded: z.boolean().optional(),
  inbox_assigned_to_me: z.boolean().optional(),
  inbox_mentioned: z.boolean().optional(),
})

export const WorkspaceMemberSettingsSchema = createInsertSchema(
  workspaceMemberSettings,
)
  .omit({
    channels: true,
    newsletters: true,
    topics: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    channels: NotificationChannelsSchema.optional(),
    newsletters: NewslettersSchema.optional(),
    topics: NotificationTopicsSchema.optional(),
  })

export type WorkspaceMemberSettingsDTO = z.infer<
  typeof WorkspaceMemberSettingsSchema
>
