import { Box, ButtonGroup, Card, Spacer, Span, Text } from "@chakra-ui/react";
import { LuEllipsis } from "react-icons/lu";

import * as GridList from "@/components/ui/grid-list/grid-list";
import * as Menu from "@/components/ui/menu/menu";
import * as Persona from "@/components/ui/persona/persona";
import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import type { PersonaPresence } from "@/components/ui/persona/presence";
import { SearchInput } from "@/components/ui/search-input/search-input";
import { Tag } from "@/components/ui/tag/tag";

export interface Member {
  name: string;
  email: string;
  status: "active" | "inactive" | "invited";
  role: string;
  avatar: string;
  presence?: PersonaPresence;
}

export interface WorkspaceMembersSettingsProps {
  members: Array<Member>;
}

const states = {
  active: {
    label: "Active",
  },
  inactive: {
    label: "Suspended",
  },
  invited: {
    label: "Invited",
  },
} as const;

export function WorkspaceMembersSettings(props: WorkspaceMembersSettingsProps) {
  const activeMembers = props.members.filter(
    (member) => member.status === "active",
  );

  const inactiveMembers = props.members.filter((member) =>
    ["inactive", "invited"].includes(member.status),
  );

  return (
    <Card.Root>
      <Card.Header borderBottomWidth="1px">
        <Card.Title>Members</Card.Title>
        <ButtonGroup>
          <Box minW="300px">
            <SearchInput placeholder="Filter by name or email..." />
          </Box>
          <Spacer />
          <Button colorPalette="accent" variant="solid" size="sm">
            Invite people
          </Button>
        </ButtonGroup>
      </Card.Header>

      <GridList.Root py="0">
        <GridList.Header
          fontWeight="medium"
          textStyle="xs"
          bg="bg.muted"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          gap="2"
        >
          Active <Span color="fg.muted">{activeMembers.length}</Span>
        </GridList.Header>
        {activeMembers.map((member) => (
          <MemberItem key={member.email} member={member} />
        ))}
        <GridList.Header
          fontWeight="medium"
          textStyle="xs"
          bg="bg.muted"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          gap="2"
        >
          Inactive <Span color="fg.muted">{inactiveMembers.length}</Span>
        </GridList.Header>
        {inactiveMembers.map((member) => (
          <MemberItem key={member.email} member={member} />
        ))}
      </GridList.Root>
    </Card.Root>
  );
}

function MemberItem({ member }: { member: Member }) {
  return (
    <GridList.Item
      key={member.email}
      data-active={member.status !== "active" ? "false" : "true"}
      role="group"
      borderBottomWidth="1px"
      css={{
        "&:last-of-type": { borderWidth: 0 },
        "&[data-active=false]": { color: "fg.muted" },
      }}
    >
      <GridList.Cell px="1">
        <Persona.Root size="xs" presence={member.presence}>
          <Persona.Avatar name={member.name} src={member.avatar}>
            <Persona.PresenceBadge />
          </Persona.Avatar>
        </Persona.Root>
      </GridList.Cell>
      <GridList.Cell flex="1">
        <Text fontWeight="medium" textStyle="sm">
          {member.name || member.email}
        </Text>
        <Text color="fg.muted" textStyle="xs">
          {member.name ? member.email : null}
        </Text>
      </GridList.Cell>
      <GridList.Cell px="4" gap="1" display="flex" flexDirection="row">
        {member.status === "active" ? (
          <Tag size="sm">{member.role}</Tag>
        ) : (
          <Tag size="sm" color="fg.muted">
            {states[member.status].label}
          </Tag>
        )}
      </GridList.Cell>
      <GridList.Cell opacity="0" _groupHover={{ opacity: 1 }}>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton variant="ghost" size="sm" aria-label="More">
              <LuEllipsis />
            </IconButton>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="remove">Remove</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </GridList.Cell>
    </GridList.Item>
  );
}
