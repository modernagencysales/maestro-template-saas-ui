import * as z from 'zod'

export const workspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your workspace name.')
    .min(2, 'Please choose a name with at least 3 characters.')
    .max(50, 'The name should be no longer than 50 characters.')
    .describe('Name'),
  slug: z
    .string()
    .min(1, 'Please enter your workspace URL.')
    .min(3, 'Please choose an URL with at least 3 characters.')
    .max(50, 'The URL should be no longer than 50 characters.')
    .regex(
      /^[a-z0-9-]+$/,
      'The URL should only contain lowercase letters, numbers, and dashes.',
    ),
})

export type WorkspaceFormInput = z.infer<typeof workspaceSchema>
