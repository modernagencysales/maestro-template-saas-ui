import { and, db, eq, tags } from '@workspace/db'

export const createTag = async (args: {
  id: string
  workspaceId: string
  name: string
  color?: string | null
}) => {
  const result = await db
    .insert(tags)
    .values({
      id: args.id,
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
    })
    .returning()
    .execute()

  return result[0]
}

export const updateTag = async (args: {
  id: string
  workspaceId: string
  name?: string
  color?: string | null
}) => {
  const { id, workspaceId, ...$set } = args

  const result = await db
    .update(tags)
    .set($set)
    .where(and(eq(tags.id, id), eq(tags.workspaceId, workspaceId)))
    .returning()
    .execute()

  return result[0]
}

export const deleteTag = async (args: { id: string; workspaceId: string }) => {
  // TODO - Add a check to see if the tag is being used in any entities
  await db
    .delete(tags)
    .where(and(eq(tags.id, args.id), eq(tags.workspaceId, args.workspaceId)))
    .execute()
}
