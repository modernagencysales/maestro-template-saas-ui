import * as dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: ['../../.env', '../../.env.local'] })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const connectionString = process.env.DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  strict: true,
  schema: ['./src/**/*.sql.ts'],
  out: './drizzle',
  verbose: true,
  dbCredentials: { url: connectionString },
  tablesFilter: ['*'],
})
