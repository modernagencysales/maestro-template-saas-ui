import type { TagDTO } from '@workspace/api/types'

import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'

export type TagOption = { id: string; label: string; color?: string }

export const toTagOption = (tag: TagDTO): TagOption => ({
  id: tag.id,
  label: tag.name,
  color: tag.color ?? undefined,
})

export const useTags = () => {
  const [workspace] = useCurrentWorkspace()

  return workspace.tags
}

export const useTagOptions = () => useTags().map(toTagOption)
