import { Card, Stack, Switch, Text } from "@saas-ui/react";

// Adapted from saas-js/saas-ui-pro@ac3a40c8dc05e403f9d501a87c092646891d3c40 notification-settings.tsx.
export interface NotificationPreference {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
}
export function NotificationSettings({
  onChange,
  preferences,
}: {
  readonly onChange: (id: string, enabled: boolean) => void;
  readonly preferences: readonly NotificationPreference[];
}) {
  return (
    <Card.Root>
      <Card.Body>
        <Stack gap="6">
          {preferences.map((preference) => (
            <Switch
              checked={preference.enabled}
              key={preference.id}
              onCheckedChange={({ checked }) =>
                onChange(preference.id, checked)
              }
            >
              <Stack gap="0">
                <Text>{preference.label}</Text>
                <Text color="fg.muted" fontSize="sm">
                  {preference.description}
                </Text>
              </Stack>
            </Switch>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
