import { defineRelations } from 'drizzle-orm'

import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  users: {
    userProfile: r.one.userProfiles({
      from: r.users.id,
      to: r.userProfiles.id,
    }),
    memberships: r.many.workspaceMembers(),
  },
  userProfiles: {
    user: r.one.users({
      from: r.userProfiles.id,
      to: r.users.id,
    }),
  },
  workspaces: {
    members: r.many.workspaceMembers(),
    account: r.one.billingAccounts({
      from: r.workspaces.id,
      to: r.billingAccounts.id,
    }),
    subscription: r.one.billingSubscriptions({
      from: r.workspaces.id,
      to: r.billingSubscriptions.accountId,
    }),
    tags: r.many.tags(),
  },
  workspaceMembers: {
    workspace: r.one.workspaces({
      from: r.workspaceMembers.workspaceId,
      to: r.workspaces.id,
    }),
    user: r.one.users({
      from: r.workspaceMembers.userId,
      to: r.users.id,
    }),
  },
  workspaceInvitations: {
    workspace: r.one.workspaces({
      from: r.workspaceInvitations.workspaceId,
      to: r.workspaces.id,
    }),
    user: r.one.users({
      from: r.workspaceInvitations.userId,
      to: r.users.id,
      alias: 'workspaceInvitationUser',
    }),
    inviter: r.one.users({
      from: r.workspaceInvitations.invitedBy,
      to: r.users.id,
      alias: 'workspaceInvitationInviter',
    }),
  },
  billingAccounts: {
    subscription: r.one.billingSubscriptions({
      from: r.billingAccounts.id,
      to: r.billingSubscriptions.accountId,
    }),
  },
  tags: {
    workspace: r.one.workspaces({
      from: r.tags.workspaceId,
      to: r.workspaces.id,
    }),
  },
  activityLogs: {
    actor: r.one.users({
      from: r.activityLogs.actorId,
      to: r.users.id,
    }),
  },
  notifications: {
    readBy: r.one.users({
      from: r.notifications.readById,
      to: r.users.id,
      alias: 'notificationReadBy',
    }),
    actor: r.one.users({
      from: r.notifications.actorId,
      to: r.users.id,
      alias: 'notificationActor',
    }),
  },
}))
