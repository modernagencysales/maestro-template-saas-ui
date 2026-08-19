import slug from 'slug'
import { z } from 'zod'

import { createTRPCRouter, workspaceProcedure } from '#trpc'

import { CreateTagSchema, UpdateTagSchema } from './tags.schema'
import { createTag, deleteTag, updateTag } from './tags.service'

export const tagsRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(CreateTagSchema)
    .mutation(async ({ input }) => {
      const id = slug(input.name, { lower: true })

      return createTag({
        id,
        workspaceId: input.workspaceId,
        name: input.name,
        color: input.color,
      })
    }),
  update: workspaceProcedure
    .input(UpdateTagSchema)
    .mutation(async ({ input }) => {
      return updateTag({
        id: input.id,
        workspaceId: input.workspaceId,
        name: input.name,
        color: input.color,
      })
    }),
  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return deleteTag({
        id: input.id,
        workspaceId: input.workspaceId,
      })
    }),
})
