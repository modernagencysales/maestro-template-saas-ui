import { z } from 'zod'

import { findActivitiesByContactId } from '#modules/activity-logs/activity-logs.service'
import { TRPCError, createTRPCRouter, workspaceProcedure } from '#trpc'
import { PaginationSchema } from '#utils/pagination'

import {
  ContactSchema,
  CreateContactInputSchema,
  UpdateContactInputSchema,
} from './contacts.schema'
import {
  createComment,
  createContact,
  deleteComment,
  findContactsByType,
  getContactById,
  updateContact,
  updateContactTags,
} from './contacts.service'

export const contactsRouter = createTRPCRouter({
  byId: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const contact = await getContactById(input)

      if (!contact) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return contact
    }),
  listByType: workspaceProcedure
    .input(
      ContactSchema.pick({ type: true })
        .partial({
          type: true,
        })
        .merge(PaginationSchema),
    )
    .query(async ({ input }) => {
      const contacts = await findContactsByType(input)

      if (!contacts) {
        return {
          contacts: [],
        }
      }

      return {
        contacts,
      }
    }),
  create: workspaceProcedure
    .input(CreateContactInputSchema)
    .mutation(({ ctx, input }) => {
      return createContact({
        userId: ctx.session.user.id,
        ...input,
      })
    }),
  update: workspaceProcedure
    .input(UpdateContactInputSchema)
    .mutation(async ({ ctx, input }) => {
      return updateContact({
        userId: ctx.session.user.id,
        ...input,
      })
    }),
  activitiesById: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const activities = await findActivitiesByContactId({
        workspaceId: input.workspaceId,
        id: input.id,
      })

      return {
        activities: activities.map((activity) => ({
          id: activity.id,
          actorId: activity.actorId,
          actorType: activity.actorType,
          metadata: activity.metadata,
          type: activity.type,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
        })),
      }
    }),
  addComment: workspaceProcedure
    .input(
      z.object({
        contactId: z.string(),
        comment: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await createComment({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        userId: ctx.session.user.id,
        comment: input.comment,
      })
    }),
  removeComment: workspaceProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await deleteComment({
        workspaceId: input.workspaceId,
        commentId: input.commentId,
      })
    }),
  updateTags: workspaceProcedure
    .input(
      z.object({
        contactId: z.string(),
        tags: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateContactTags({
        workspaceId: input.workspaceId,
        userId: ctx.session.user.id,
        contactId: input.contactId,
        tags: input.tags,
      })
    }),
})
