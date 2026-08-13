import { Building2, Check, ChevronDown } from "lucide-react";
import { Icon, Menu, Text } from "@saas-ui/react";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/components/workspaces-menu.tsx. Workspace data is
// caller-owned; a fresh template exposes only its current neutral workspace.
export function WorkspacesMenu() {
  return (
    <Menu.Root>
      <Menu.Button
        aria-label="Current workspace is Maestro workspace"
        justifyContent="flex-start"
        variant="ghost"
        width="full"
      >
        <Icon as={Building2} />
        <Text flex="1" textAlign="start" truncate>
          Maestro workspace
        </Text>
        <Icon as={ChevronDown} />
      </Menu.Button>
      <Menu.Content>
        <Menu.Item value="current">
          <Icon as={Building2} />
          Maestro workspace
          <Icon as={Check} marginInlineStart="auto" />
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}
