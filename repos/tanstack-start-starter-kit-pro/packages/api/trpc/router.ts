/**
 * This file is the main entry point for the TRPC router.
 *
 * It imports all the routers from the various modules and combines them into a single router.
 * Any new routers should be added here.
 */
import { authRouter } from '#modules/auth/auth.router'
import { billingRouter } from '#modules/billing/billing.router'
import { contactsRouter } from '#modules/contacts/contacts.router'
import { dashboardRouter } from '#modules/dashboard/dashboard.router'
import { notificationsRouter } from '#modules/notifications/notifications.router'
import { tagsRouter } from '#modules/tags/tags.router'
import { usersRouter } from '#modules/users/users.router'
import { workspaceMembersRouter } from '#modules/workspace-members/workspace-members.router'
import { workspacesRouter } from '#modules/workspaces/workspaces.router'
import { createTRPCRouter } from '#trpc'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  billing: billingRouter,
  contacts: contactsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  tags: tagsRouter,
  users: usersRouter,
  workspaces: workspacesRouter,
  workspaceMembers: workspaceMembersRouter,
})

export type AppRouter = typeof appRouter
