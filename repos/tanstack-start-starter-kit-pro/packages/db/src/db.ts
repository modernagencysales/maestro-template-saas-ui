import { drizzle } from 'drizzle-orm/postgres-js'

import { relations } from './relations'

export const db = drizzle(process.env.DATABASE_URL!, {
  relations,
  logger: process.env.NODE_ENV !== 'production',
})
