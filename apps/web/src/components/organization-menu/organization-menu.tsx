import * as React from "react";

import { Box, Icon, Text } from "@chakra-ui/react";
import { FaMagento, FaPaypal, FaSpotify } from "react-icons/fa6";
import { LuCheck, LuPlus, LuSettings } from "react-icons/lu";

import * as Menu from "@/components/ui/menu/menu";
import { IconBadge } from "@/components/ui/icon-badge/icon-badge";

export const OrganizationMenu: React.FC = () => {
  const [currentOrg, setOrg] = React.useState("paypal");

  const orgs = [
    {
      name: "Paypal",
      slug: "paypal",
      plan: "Free plan",
      icon: FaPaypal,
      color: "#00457C",
    },
    {
      name: "Spotify",
      slug: "spotify",
      plan: "Trial",
      icon: FaSpotify,
      color: "#1ED760",
    },
    {
      name: "Magento",
      slug: "magento",
      plan: "Professional plan",
      icon: FaMagento,
      color: "#000000",
    },
  ] as const;

  const selected = orgs.find((r) => r.slug === currentOrg) ?? orgs[0];

  return (
    <Menu.Root defaultOpen closeOnSelect={false}>
      <Menu.Button variant="ghost">
        <IconBadge
          bg={selected.color}
          variant="solid"
          size="sm"
          boxSize="5"
          icon={<Icon as={selected.icon} color="white" />}
        />
        {selected.name}
      </Menu.Button>
      <Menu.Content maxW="280px">
        <Menu.ItemGroup
          title="Organizations"
          color="muted"
          fontWeight="medium"
          mt="0"
        >
          {orgs.map(({ name, slug, plan, icon, color }) => (
            <Menu.Item
              key={slug}
              value={slug}
              position="relative"
              pe="8"
              onClick={() => setOrg(slug)}
            >
              <IconBadge
                bg={color}
                variant="solid"
                icon={<Icon as={icon} color="white" />}
              />
              <Box>
                <Text textStyle="sm" fontWeight="medium">
                  {name}
                </Text>
                <Text textStyle="xs" color="gray.500">
                  {plan}
                </Text>
              </Box>
              {slug === currentOrg && (
                <Icon
                  as={LuCheck}
                  fontSize="1.2em"
                  position="absolute"
                  top="2.5"
                  right="2.5"
                />
              )}
            </Menu.Item>
          ))}
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.ItemGroup>
          <Menu.Item value="settings">
            <Icon as={LuSettings} fontSize="1.2em" />
            Settings
          </Menu.Item>
          <Menu.Item value="add-organization">
            <Icon as={LuPlus} fontSize="1.2em" />
            Create an organization
          </Menu.Item>
        </Menu.ItemGroup>
        <Menu.Separator />
        <Menu.ItemGroup>
          <Menu.Item value="logout">Log out</Menu.Item>
        </Menu.ItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
};
