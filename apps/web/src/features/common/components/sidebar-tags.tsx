import React from "react";

import { Text, useControllableState } from "@chakra-ui/react";
import { createLink } from "@tanstack/react-router";

import type { TagDTO } from "@workspace/api/types";
import {
  SortableNavGroup,
  SortableNavItem,
} from "@workspace/ui/sortable-nav-group";
import { TagColor } from "@workspace/ui/tags-list";

import { useTags } from "../hooks/use-tags";
import { useWorkspaceSlug } from "../hooks/use-workspace-slug";

export const AppSidebarTags = () => {
  const workspace = useWorkspaceSlug();

  const tags = useTags();

  const getSortedTags = React.useCallback((tags: TagDTO[]) => {
    return tags as TagDTO[];
  }, []);

  const [sortedTags, setTags] = useControllableState<TagDTO[]>({
    defaultValue: getSortedTags(tags || []),
    onChange(tags) {
      void tags;
    },
  });

  if (!sortedTags.length) {
    return null;
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
            isActive: true,
          }}
          icon={<TagColor color={tag.color ?? undefined} />}
        >
          <Text>{tag.name}</Text>
        </TagLink>
      ))}
    </SortableNavGroup>
  );
};

const TagLink = createLink(SortableNavItem);
