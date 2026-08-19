/**
 * Better Auth schemas
 * @see https://www.better-auth.com/docs/concepts/database
 */
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { createId, timestamps } from '../utils'

export const users = pgTable('auth_users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: boolean('email_verified'),
  image: text('image'),
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  ...timestamps,
})

export const accounts = pgTable(
  'auth_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    accountId: text('account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    ...timestamps,
  },
  (account) => [unique().on(account.providerId, account.accountId)],
)

export const sessions = pgTable('auth_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  token: text('token').unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  impersonatedBy: text('impersonated_by'),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
  }).notNull(),
  ...timestamps,
})

export const verifications = pgTable(
  'auth_verifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (verificationToken) => [
    {
      token: unique().on(verificationToken.identifier, verificationToken.value),
    },
  ],
)

export const authenticators = pgTable(
  'auth_authenticators',
  {
    credentialId: text('credential_id').notNull().unique(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: boolean('credential_backed_up').notNull(),
    transports: text('transports'),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialId],
      }),
    },
  ],
)
