import * as React from "react";

import { Card, Heading, Text } from "@chakra-ui/react";
import { LuEllipsisVertical } from "react-icons/lu";

import * as GridList from "@/components/ui/grid-list/grid-list";
import * as Menu from "@/components/ui/menu/menu";
import * as Persona from "@/components/ui/persona/persona";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import type { PersonaPresence } from "@/components/ui/persona/presence";

export interface LatestMessagesCardProps {
  items: Array<{
    name: string;
    avatar: string;
    date: string;
    message: string;
    presence: PersonaPresence;
    unread: boolean;
  }>;
}

export function LatestMessagesCard(props: LatestMessagesCardProps) {
  const { items } = props;

  return (
    <Card.Root>
      <Card.Header borderBottomWidth="1px">
        <Heading size="sm" fontWeight="medium">
          Latest messages
        </Heading>
      </Card.Header>
      <Card.Body p="0">
        <GridList.Root pb="0" interactive>
          {items.map((item, i) => (
            <GridList.Item key={i} data-unread={item.unread ? "" : undefined}>
              <GridList.Cell px="2">
                <Persona.Root size="sm" presence={item.presence}>
                  <Persona.Avatar name={item.name} src={item.avatar}>
                    <Persona.PresenceBadge />
                  </Persona.Avatar>
                </Persona.Root>
              </GridList.Cell>
              <GridList.Cell flex="1" px="2">
                <Heading
                  as="h4"
                  size="xs"
                  mb="0.5"
                  fontWeight="medium"
                  display="flex"
                  alignItems="center"
                  css={{
                    "[data-unread] &": {
                      fontWeight: "bold",
                      _before: {
                        content: '""',
                        display: "inline-block",
                        verticalAlign: "middle",
                        borderRadius: "full",
                        position: "relative",
                        boxSize: "2",
                        bg: "accent.solid",
                        me: 2,
                      },
                    },
                  }}
                >
                  {item.name}
                </Heading>
                <Text
                  color={item.unread ? "inherit" : "fg.muted"}
                  textStyle="xs"
                  lineClamp={1}
                >
                  {item.message}
                </Text>
              </GridList.Cell>
              <GridList.Cell>
                <Text color="fg.muted" textStyle="xs">
                  {item.date}
                </Text>
              </GridList.Cell>
              <GridList.Cell px="2">
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="More options"
                    >
                      <LuEllipsisVertical />
                    </IconButton>
                  </Menu.Trigger>
                  <Menu.Content>
                    <Menu.Item value="reply">Reply</Menu.Item>
                  </Menu.Content>
                </Menu.Root>
              </GridList.Cell>
            </GridList.Item>
          ))}
          <GridList.Item bg="bg.muted" borderBottomRadius="md" mt="2">
            <Text flex="1" textAlign="center" fontSize="sm">
              View all messages
            </Text>
          </GridList.Item>
        </GridList.Root>
      </Card.Body>
    </Card.Root>
  );
}
