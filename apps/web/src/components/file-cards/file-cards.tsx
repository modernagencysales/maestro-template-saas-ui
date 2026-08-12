import {
  AspectRatio,
  Card,
  Center,
  HStack,
  Heading,
  Icon,
  Image,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  FaFile,
  FaFileImage,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
} from "react-icons/fa6";
import { LuEllipsisVertical } from "react-icons/lu";

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

export type FileCardProps = {
  name: string;
  type: string;
  previewUrl?: string;
  icon: React.ReactNode;
  color?: string;
  size?: string;
  modifiedAt?: string;
};

export const FileCard: React.FC<FileCardProps> = (props) => {
  return (
    <Card.Root role="group" position="relative">
      <Card.Header position="absolute" top="0" right="0" zIndex="1">
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="View options"
              variant="solid"
              boxShadow="sm"
              borderWidth="1px"
              opacity={0}
              _groupHover={{ opacity: 1 }}
              _expanded={{ opacity: 1 }}
            >
              <LuEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="delete">Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Card.Header>
      <Card.Body
        borderTopRadius="md"
        p="0"
        bg="bg.muted"
        position="relative"
        overflow="hidden"
      >
        <AspectRatio ratio={16 / 9} bg="">
          {props.previewUrl ? (
            <Image src={props.previewUrl} />
          ) : (
            <Center>
              <Icon boxSize="12" color="fg.muted">
                <FaFile />
              </Icon>
            </Center>
          )}
        </AspectRatio>
      </Card.Body>
      <Card.Footer>
        <HStack gap="3" alignItems="center">
          <IconBadge color={props.color}>{getIcon(props.type)}</IconBadge>

          <VStack alignItems="flex-start" gap="0">
            <Heading as="h4" size="sm" fontWeight="medium">
              {props.name}
            </Heading>
            <Text color="fg.muted" textStyle="xs">
              {props.size} • {props.modifiedAt}
            </Text>
          </VStack>
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
};

export const FileCards = (props: { files: FileCardProps[] }) => {
  return (
    <SimpleGrid columns={3} gap="4">
      {props.files.map((file, i) => (
        <FileCard key={`${file.name}_${i}`} {...file} />
      ))}
    </SimpleGrid>
  );
};
