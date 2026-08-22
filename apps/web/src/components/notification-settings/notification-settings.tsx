import { Card, Field, Text } from "@chakra-ui/react";

import * as GridList from "@/components/ui/grid-list/grid-list";
import { Switch } from "@/components/ui/switch/switch";

interface NotificationItemProps {
  title: string;
  name: string;
  description?: string;
  isChecked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = (props) => {
  const { title, name, description, defaultChecked, isChecked, onChange } =
    props;
  return (
    <GridList.Item
      asChild
      css={{
        "&:not(&:last-child)::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "block",
          height: "1px",
          width: "100%",
          backgroundColor: "var(--chakra-colors-border-subtle)",
        },
      }}
    >
      <Field.Root>
        <GridList.Cell flex="1">
          <Field.Label textStyle="sm" userSelect="none">
            {title}
          </Field.Label>
          {description ? (
            <Text color="fg.muted" textStyle="xs">
              {description}
            </Text>
          ) : null}
        </GridList.Cell>
        <GridList.Cell>
          <Switch
            size="sm"
            defaultChecked={defaultChecked}
            checked={isChecked}
            onCheckedChange={({ checked }) => onChange?.(checked)}
          />
        </GridList.Cell>
      </Field.Root>
    </GridList.Item>
  );
};

export function NotificationSettings() {
  return (
    <Card.Root width="full">
      <Card.Body>
        <GridList.Root>
          <NotificationItem
            name="assigned"
            title="Assigned"
            description="A conversation is assigned to me."
          />
          <NotificationItem
            name="mentioned"
            title="Mentions"
            description="Somebody mentions me."
            defaultChecked
          />
          <NotificationItem
            name="lead-qualified"
            title="Lead qualified"
            description="A lead is qualified."
            defaultChecked
          />
          <NotificationItem
            name="deal-closed"
            title="Deal closed"
            description="A deal is closed."
            defaultChecked
          />
        </GridList.Root>
      </Card.Body>
    </Card.Root>
  );
}
