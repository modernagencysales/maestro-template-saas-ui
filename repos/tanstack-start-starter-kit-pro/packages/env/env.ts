import { z } from 'zod'

import { createEnv } from './create-env'

export const env = createEnv(
  z.object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    APP_URL: z.string().optional().default('http://localhost:3000'),

    DATABASE_URL: z.string(),

    DEFAULT_PLAN_ID: z.string().optional(),
    DEFAULT_IS_FREE: z.string().optional(),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string(),

    AUTH_SECRET: z.string(),
  }),
)
