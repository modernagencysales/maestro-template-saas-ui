import React, { useMemo } from 'react'

import { Text, useControllableState } from '@chakra-ui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createLink } from '@tanstack/react-router'

import type { TagDTO } from '@workspace/api/types'
import {
  SortableNavGroup,
  SortableNavItem,
} from '@workspace/ui/sortable-nav-group'
import { TagColor } from '@workspace/ui/tags-list'

import { useTags } from '../hooks/use-tags'
import { useWorkspaceSlug } from '../hooks/use-workspace-slug'

export const AppSidebarTags = () => {
  const queryClient = useQueryClient()
  const workspace = useWorkspaceSlug()

  // @TODO implement this
  const userTags: Array<string> = useMemo(() => [], [])

  const tags = useTags()

  const mutation = useMutation({
    mutationFn: async (tags: Array<string>) => {
      /**
       * This just updates the local cache, you should also update the server.
       */
      queryClient.setQueryData<any>(
        ['CurrentUser'],
        (data: { currentUser: any }) => ({
          currentUser: {
            ...data.currentUser,
            workspace: {
              ...data?.currentUser?.workspace,
              tags,
            },
          },
        }),
      )
    },
  })

  const getSortedTags = React.useCallback(
    (tags: TagDTO[]) => {
      return userTags
        .map((id) => tags.find((tag) => tag.id === id))
        .filter(Boolean) as TagDTO[]
    },
    [userTags],
  )

  const [sortedTags, setTags] = useControllableState<TagDTO[]>({
    defaultValue: getSortedTags(tags || []),
    onChange(tags) {
      if (sortedTags.length) {
        mutation.mutate(tags.map(({ id }) => id))
      }
    },
  })

  if (!sortedTags.length) {
    return null
  }

  return (
    <SortableNavGroup
      title="Tags"
      isCollapsible
      items={sortedTags}
      onSorted={setTags}
    >
      {sortedTags.map((tag) => (
        <TagLink
          as="a"
          key={tag.id}
          id={tag.id}
          my="0"
          to="/$workspace/tag/$tag"
          params={{
            workspace,
            tag: tag.id,
          }}
          activeProps={{
            'data-active': true,
          }}
        >
          <TagColor color={tag.color ?? undefined} />
          <Text>{tag.name}</Text>
        </TagLink>
      ))}
    </SortableNavGroup>
  )
}

const TagLink = createLink(SortableNavItem)
