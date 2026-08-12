import * as React from "react";

import { Aside } from "@saas-ui-pro/react";
import {
  Box,
  Button,
  Collapsible,
  DataList,
  Icon,
  Persona,
  Stack,
} from "@saas-ui/react";
import { useMutation } from "@tanstack/react-query";
import { LuChevronRight } from "react-icons/lu";

import type { ContactDTO } from "@workspace/api/types";
import { DateTime } from "@workspace/i18n";
import { OverflowMenu } from "@workspace/ui/overflow-menu";
import {
  AddTag,
  TagColor,
  TagsList,
  TagsListItem,
} from "@workspace/ui/tags-list";

import { useTags } from "#features/common/hooks/use-tags";
import { api } from "#lib/trpc/react";

import { ContactStatus } from "../common/contact-status";
import { ContactType } from "../common/contact-type";

export interface ContactSidebarProps extends Aside.RootProps {
  contact?: ContactDTO | null;
}

export const ContactSidebar: React.FC<ContactSidebarProps> = (props) => {
  const { contact, ...rest } = props;

  return (
    <Aside.Root
      width="360px"
      minWidth="200px"
      maxWidth={{ base: "80%", lg: "500px" }}
      position={{ base: "absolute", lg: "static" }}
      top="0"
      bottom="0"
      right="0"
      zIndex="docked"
      boxShadow="md"
      bg="bg.panel"
      borderLeftWidth="1px"
      size="lg"
      {...rest}
    >
      {contact ? (
        <>
          <Aside.Header flexDirection="column" alignItems="flex-start" gap="4">
            <Stack direction="row" w="full">
              <Persona.Root flex="1" size="sm">
                <Persona.Avatar />
                <Persona.Details>
                  <Persona.Label>{contact?.name || ""}</Persona.Label>
                  <Persona.SecondaryLabel>
                    {contact?.email}
                  </Persona.SecondaryLabel>
                </Persona.Details>
              </Persona.Root>
              <OverflowMenu.Root>
                <OverflowMenu.Item value="delete">Delete</OverflowMenu.Item>
              </OverflowMenu.Root>
            </Stack>
          </Aside.Header>
          <ContactDetails contact={contact} />
        </>
      ) : null}
    </Aside.Root>
  );
};

function ContactDetails({ contact }: { contact: ContactDTO }) {
  const tags = contact.tags || [];

  const allTags = useTags();

  const utils = api.useUtils();

  const updateTags = useMutation({
    mutationFn: async (tags: string[]) => {
      /**
       * We update the cache here optimistically, so that the UI updates
       * immediately.
       *
       * You should call your api here to update the contact tags.
       *
       * If the mutation fails, we can use the `onError` callback to revert.
       */
      utils.contacts.byId.setData(
        {
          workspaceId: contact.workspaceId,
          id: contact.id,
        },
        {
          ...contact,
          tags,
        },
      );
    },
  });

  const onCreateTags = (tag: string) => {
    updateTags.mutate([tag]);
  };

  const onChangeTags = (tags: string[]) => {
    updateTags.mutate(tags);
  };

  const tagsAnchor = React.useRef<HTMLDivElement>(null);

  return (
    <Box p="6" borderBottomWidth="1px">
      <Collapsible.Root defaultOpen role="group">
        <Collapsible.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            ms="-2.5"
            color="fg.muted"
            _expanded={{
              bg: "transparent",
            }}
          >
            Details
            <Icon
              transitionProperty="transform"
              transitionDuration="fast"
              _groupOpen={{
                transform: "rotate(90deg)",
              }}
            >
              <LuChevronRight />
            </Icon>
          </Button>
        </Collapsible.Trigger>

        <Collapsible.Content pt="4">
          <DataList.Root orientation="horizontal" size="sm">
            <Property
              label="Type"
              value={<ContactType type={contact?.type} ms="-2" />}
            />
            <Property
              label="Status"
              value={<ContactStatus status={contact.status || "new"} ms="-2" />}
            />
            <Property
              label="Signed up"
              value={<DateTime date={new Date(contact.createdAt)} />}
            />
            <Property
              label="Tags"
              value={
                <TagsList mt="2" ms="-2" ref={tagsAnchor}>
                  {tags.map((t) => {
                    const tag = allTags?.find((tag) => tag.label === t);
                    return (
                      <TagsListItem
                        key={t}
                        icon={<TagColor color={tag?.color || "gray"} />}
                      >
                        {tag?.label || t}
                      </TagsListItem>
                    );
                  })}
                  <AddTag
                    tags={allTags ?? []}
                    onCreate={onCreateTags}
                    onChange={onChangeTags}
                    positioning={{
                      placement: "left-start",
                      getAnchorRect: () => {
                        const rect =
                          tagsAnchor.current!.getBoundingClientRect();

                        return {
                          x: rect?.x,
                          y: rect?.y,
                          width: rect?.width,
                          height: rect?.height,
                        };
                      },
                    }}
                  />
                </TagsList>
              }
            />
          </DataList.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}

function Property({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <DataList.Item>
      <DataList.ItemLabel minWidth="80px">{label}</DataList.ItemLabel>
      <DataList.ItemValue>{value}</DataList.ItemValue>
    </DataList.Item>
  );
}
