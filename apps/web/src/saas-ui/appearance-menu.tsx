import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Icon, Menu } from "@saas-ui/react";
import { useColorMode, type AppearancePreference } from "./color-mode";

export const appearanceOptions = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
] as const satisfies readonly {
  readonly label: string;
  readonly value: AppearancePreference;
}[];

const optionIcon = { light: Sun, dark: Moon, system: Monitor } as const;

export function AppearanceMenu({
  defaultOpen = false,
}: {
  readonly defaultOpen?: boolean;
}) {
  const { appearance, setAppearance } = useColorMode();

  return (
    <Menu.Root defaultOpen={defaultOpen}>
      <Menu.Button aria-label="Choose appearance" variant="ghost">
        Appearance
      </Menu.Button>
      <Menu.Content portalled={false}>
        <Menu.RadioItemGroup
          onValueChange={({ value }) =>
            setAppearance(value as AppearancePreference)
          }
          value={appearance}
        >
          {appearanceOptions.map((option) => {
            const OptionIcon = optionIcon[option.value];

            return (
              <Menu.RadioItem
                key={option.value}
                startElement={<Icon as={OptionIcon} />}
                value={option.value}
              >
                <Menu.ItemText>{option.label}</Menu.ItemText>
                <Menu.ItemIndicator>
                  <Icon as={Check} />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            );
          })}
        </Menu.RadioItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
}
