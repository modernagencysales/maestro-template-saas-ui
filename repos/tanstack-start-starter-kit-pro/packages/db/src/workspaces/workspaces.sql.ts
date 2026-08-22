import { InferSelectModel } from 'drizzle-orm'
import {
  boolean,
  jsonb,
  pgEnum,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { pgTable } from '../_table'
import { users } from '../auth/auth.sql'
import { id, timestamps, userId, workspaceId } from '../utils'

export const workspaces = pgTable(
  'workspaces',
  {
    ...id,
    ownerId: varchar('owner_id', { length: 255 }),
    slug: varchar('slug', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    logo: varchar('logo', { length: 255 }),
    ...timestamps,
  },
  (workspace) => [uniqueIndex('slug_idx').on(workspace.slug)],
)

export const workspaceMemberStatus = pgEnum('workspace_member_status', [
  'active',
  'suspended',
  'invited',
])

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    userId: varchar('user_id', { length: 255 })
      .references(() => users.id)
      .notNull(),
    workspaceId: varchar('workspace_id', { length: 255 })
      .references(() => workspaces.id)
      .notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    status: workspaceMemberStatus('status').notNull().default('active'),
    invitedAt: timestamp('invited_at'),
    ...timestamps,
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.workspaceId],
      name: 'workspace_members_pk',
    }),
  ],
)

export const workspaceMemberSettings = pgTable(
  'workspace_member_settings',
  {
    userId: varchar('user_id', { length: 255 })
      .references(() => users.id)
      .notNull(),
    workspaceId: varchar('workspace_id', { length: 255 })
      .references(() => workspaces.id)
      .notNull(),
    channels: jsonb('notification_channels').$type<NotificationChannelsField>(),
    topics: jsonb('notification_topics').$type<NotificationTopicsField>(),
    newsletters: jsonb('newsletters').$type<NewslettersField>(),
    ...timestamps,
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.workspaceId],
      name: 'workspace_member_settings_pk',
    }),
  ],
)

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    ...workspaceId,
    userId: userId('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    invitedBy: userId('invited_by').references(() => users.id, {
      onDelete: 'cascade',
    }),
    accepted: boolean('accepted').default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.workspaceId, t.email)],
)

export interface NotificationChannelsField {
  email?: boolean
  desktop?: boolean
}

export interface NewslettersField {
  product_updates?: boolean
  important_updates?: boolean
}

export interface NotificationTopicsField {
  contacts_new_lead?: boolean
  contacts_account_upgraded?: boolean
  inbox_assigned_to_me?: boolean
  inbox_mentioned?: boolean
}

export type WorkspaceModel = InferSelectModel<typeof workspaces>
export const WorkspaceSchema = createSelectSchema(workspaces)
export const WorkspaceInsertSchema = createInsertSchema(workspaces)

export type WorkspaceMemberModel = InferSelectModel<typeof workspaceMembers>
export const WorkspaceMemberSchema = createSelectSchema(workspaceMembers)
export const WorkspaceMemberInsertSchema = createInsertSchema(workspaceMembers)
