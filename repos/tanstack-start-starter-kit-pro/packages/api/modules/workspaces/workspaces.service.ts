import { env } from 'env'

import slug from 'slug'
import { z } from 'zod'

import { DEFAULT_WORKSPACE_TAGS } from '@workspace/config'
import {
  and,
  billingAccounts,
  billingSubscriptions,
  createId,
  db,
  eq,
  or,
  tags,
  workspaceMembers,
  workspaces,
} from '@workspace/db'

import { ServiceError } from '#utils/error'

import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
} from './workspaces.schema'

export const createWorkspace = async (
  args: z.input<typeof CreateWorkspaceSchema>,
) => {
  return db.transaction(async (tx) => {
    const result = await tx
      .insert(workspaces)
      .values({
        id: args.id ?? createId(),
        ownerId: args.ownerId,
        slug: args.slug ?? slug(args.slug),
        name: args.name,
      })
      .returning()
      .execute()

    const workspace = result[0]

    if (!workspace) {
      return
    }

    if (args.ownerId) {
      const owner = await tx.query.users.findFirst({
        where: { id: args.ownerId },
        columns: {
          id: true,
          email: true,
        },
      })

      if (!owner) {
        throw new ServiceError(
          'workspaces.owner_not_found',
          `Could not find owner with id ${args.ownerId}`,
        )
      }

      await tx
        .insert(workspaceMembers)
        .values({
          userId: owner.id,
          workspaceId: workspace.id,
          role: 'admin',
          status: 'active',
        })
        .execute()
    }

    // Create a billing account for the workspace
    // Not linked to Stripe yet, although you can already sync is there.
    await tx
      .insert(billingAccounts)
      .values({
        id: workspace.id,
      })
      .execute()

    // Create default tags
    await tx
      .insert(tags)
      .values(
        DEFAULT_WORKSPACE_TAGS.map((tag) => ({
          ...tag,
          workspaceId: workspace.id,
        })),
      )
      .execute()

    return workspace
  })
}

export const updateWorkspaceById = async (
  args: z.input<typeof UpdateWorkspaceSchema>,
) => {
  const { id, ...$set } = args

  return db.transaction(async (tx) => {
    const workspace = await tx
      .update(workspaces)
      .set($set)
      .where(eq(workspaces.id, id))
      .returning()
      .execute()

    return workspace[0]
  })
}

export const isSlugAvailable = async (slug: string) => {
  const result = await db.query.workspaces.findFirst({
    where: { slug },
    columns: {
      id: true,
    },
  })

  return !result
}

export const getWorkspace = async (idOrSlug: string) => {
  const workspace = await db.query.workspaces.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    columns: {
      id: true,
      ownerId: true,
      slug: true,
      name: true,
      logo: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      subscription: {
        columns: {
          id: true,
          planId: true,
          status: true,
          accountId: true,
          startedAt: true,
          cancelAt: true,
          canceledAt: true,
          trialEndsAt: true,
          cancelAtPeriodEnd: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      members: {
        columns: {
          role: true,
          status: true,
        },
        with: {
          user: {
            columns: {
              id: true,
              email: true,
              image: true,
              name: true,
            },
          },
        },
      },
      tags: {
        columns: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  })

  if (!workspace) {
    return null
  }

  let defaultSubscription
  // If the default plan is free, we can assume that the workspace is free.
  if (env.DEFAULT_PLAN_ID && env.DEFAULT_IS_FREE) {
    defaultSubscription = {
      planId: env.DEFAULT_PLAN_ID,
      status: 'active',
    }
  }

  return {
    ...workspace,
    subscription: workspace.subscription ?? defaultSubscription,
    members: workspace.members.flatMap((member) =>
      member.user
        ? [
            {
              id: member.user.id,
              email: member.user.email,
              image: member.user.image,
              name: member.user.name,
              roles:
                member.user.id === workspace.ownerId
                  ? ['owner'].concat(member.role)
                  : [member.role],
            },
          ]
        : [],
    ),
  }
}

export const getWorkspaceContext = async (idOrSlug: string, userId: string) => {
  const result = await db
    .select({
      id: workspaces.id,
      ownerId: workspaces.ownerId,
      slug: workspaces.slug,
      name: workspaces.name,
      logo: workspaces.logo,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      subscription: {
        id: billingSubscriptions.id,
        planId: billingSubscriptions.planId,
        status: billingSubscriptions.status,
        accountId: billingSubscriptions.accountId,
        startedAt: billingSubscriptions.startedAt,
        cancelAt: billingSubscriptions.cancelAt,
        canceledAt: billingSubscriptions.canceledAt,
        trialEndsAt: billingSubscriptions.trialEndsAt,
        cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
        currentPeriodStart: billingSubscriptions.currentPeriodStart,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      },
      member: {
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
      },
    })
    .from(workspaces)
    .where(or(eq(workspaces.id, idOrSlug), eq(workspaces.slug, idOrSlug)))
    .leftJoin(
      billingSubscriptions,
      eq(billingSubscriptions.accountId, workspaces.id),
    )
    .leftJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1)

  return result[0]
}
