import React from "react";

import { Card, Center, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import {
  FaFile,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
} from "react-icons/fa6";
import { LuEllipsisVertical } from "react-icons/lu";

import * as GridList from "@/components/ui/grid-list/grid-list";
import * as Menu from "@/components/ui/menu/menu";
import { IconBadge } from "@/components/ui/icon-badge/icon-badge";
import { IconButton } from "@/components/ui/icon-button/icon-button";

const getIcon = (type: string) => {
  switch (type) {
    case "image":
      return <FaFileImage />;
    case "document":
      return <FaFileWord />;
    case "powerpoint":
      return <FaFilePowerpoint />;
    case "pdf":
      return <FaFilePdf />;
    default:
      return <FaFile />;
  }
};

export type FilesListProps = {
  name: string;
  type: string;
  previewUrl?: string;
  color?: string;
  size?: string;
  modifiedAt?: string;
};

export const FilesListItem: React.FC<FilesListProps> = (props) => {
  return (
    <GridList.Item>
      <GridList.Cell>
        <IconBadge color={props.color}>{getIcon(props.type)}</IconBadge>
      </GridList.Cell>
      <GridList.Cell flex="1">
        <HStack gap="3" alignItems="flex-start">
          <VStack alignItems="flex-start" gap="0" lineHeight="1.4">
            <Heading as="h4" size="sm" fontWeight="medium">
              {props.name}
            </Heading>
            <Text color="fg.muted" textStyle="xs">
              {props.size} • {props.modifiedAt}
            </Text>
          </VStack>
        </HStack>
      </GridList.Cell>
      <GridList.Cell>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton aria-label="File options" variant="ghost">
              <LuEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="delete">Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </GridList.Cell>
    </GridList.Item>
  );
};

export const FilesList = (props: { files: FilesListProps[] }) => {
  return (
    <Card.Root size="md">
      <Card.Header borderBottomWidth="1px">
        <Card.Title as="h3" textStyle="md">
          Your files
        </Card.Title>
      </Card.Header>
      <Card.Body p="0">
        <GridList.Root pb="0" interactive>
          {props.files.map((file, i) => (
            <FilesListItem key={i} {...file} />
          ))}
          <GridList.Item
            bg="bg.muted"
            borderBottomRadius="md"
            mt="2"
            _hover={{
              bg: "bg.subtle",
            }}
          >
            <Center w="full">See all files</Center>
          </GridList.Item>
        </GridList.Root>
      </Card.Body>
    </Card.Root>
  );
};
