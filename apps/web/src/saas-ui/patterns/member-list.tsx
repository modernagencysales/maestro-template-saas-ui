import { Button, Card, HStack, Stack, Text } from "@saas-ui/react";
import { PageStateView } from "./page-states";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 workspace-members-settings.tsx.
export interface Member {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly status: "active" | "invited" | "suspended";
}
export function MemberList({
  members,
  onChangeRole,
}: {
  readonly members: readonly Member[];
  readonly onChangeRole: (id: string) => void;
}) {
  if (members.length === 0)
    return (
      <PageStateView
        description="Invite the first workspace member when the directory is connected."
        state="empty"
        title="No members yet"
      />
    );
  return (
    <Card.Root>
      <Card.Body>
        <Stack gap="4">
          {members.map((member) => (
            <HStack key={member.id}>
              <Stack flex="1" gap="0" minW="0">
                <Text fontWeight="medium">{member.name}</Text>
                <Text color="fg.muted" fontSize="sm" overflowWrap="anywhere">
                  {member.email}
                </Text>
              </Stack>
              <Text>
                {member.status === "suspended" ? "Suspended" : member.role}
              </Text>
              <Button
                onClick={() => onChangeRole(member.id)}
                size="sm"
                variant="ghost"
              >
                Change role
              </Button>
            </HStack>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
