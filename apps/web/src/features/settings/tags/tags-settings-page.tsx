'use client'

import { tagColors } from '@workspace/api/shared'
import { SettingsPage } from '@workspace/ui/settings-page'

import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { useTags } from '#features/common/hooks/use-tags'
import { api } from '#lib/trpc/react'

import { ManageTags } from './manage-tags'

export function TagsSettingsPage() {
  const [workspace] = useCurrentWorkspace()

  const tags = useTags()

  const utils = api.useUtils()

  const createTag = api.tags.create.useMutation({
    onSuccess: () => {
      utils.workspaces.invalidate()
    },
  })
  const updateTag = api.tags.update.useMutation({
    onSuccess: () => {
      utils.workspaces.invalidate()
    },
  })
  const deleteTag = api.tags.delete.useMutation({
    onSuccess: () => {
      utils.workspaces.invalidate()
    },
  })

  return (
    <SettingsPage title="Workspace tags" contentWidth="container.md">
      <ManageTags
        items={tags ?? []}
        colors={tagColors}
        onCreate={async (tag) => {
          await createTag.mutateAsync({
            workspaceId: workspace.id,
            name: tag.name,
            color: tag.color,
          })
        }}
        onSave={async (tag) => {
          await updateTag.mutateAsync({
            workspaceId: workspace.id,
            id: tag.id,
            name: tag.name,
            color: tag.color,
          })
        }}
        onDelete={async (id) => {
          await deleteTag.mutateAsync({
            workspaceId: workspace.id,
            id: id,
          })
        }}
      />
    </SettingsPage>
  )
}
