import { createEnv } from 'env/create'
import { z } from 'zod'

export const env = createEnv(
  z.object({
    AUTH_DEBUG: z.coerce.boolean().optional(),
    AUTH_SECRET: z.string(),
    EMAIL_FROM: z.string(),

    RESEND_API_KEY: z.string(),

    // Social providers
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
  }),
)
