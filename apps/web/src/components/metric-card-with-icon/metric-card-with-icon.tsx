import * as React from "react";

import { Box, Card, Flex, HStack, Icon } from "@chakra-ui/react";
import {
  LuArrowDownRight,
  LuArrowUpRight,
  LuMousePointerClick,
  LuUsers,
  LuWallet,
} from "react-icons/lu";

import * as Stat from "@/components/ui/stat/stat";

const getIcon = (metric: string) => {
  switch (metric) {
    case "active-users":
      return <LuUsers />;
    case "revenue":
      return <LuWallet />;
    case "avg-click-rate":
      return <LuMousePointerClick />;
    default:
      return null;
  }
};

export interface MetricCardProps {
  id: string;
  label: string;
  value: string;
  difference: string;
  isPositive: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = (props) => {
  const { id, label, value, difference, isPositive } = props;
  return (
    <Card.Root flex="1">
      <Card.Body position="relative">
        <HStack gap="3" alignItems="flex-start">
          <Icon colorPalette="gray" size="xl" mt="2">
            {getIcon(id)}
          </Icon>
          <Stat.Root gap="0">
            <Stat.Label>{label}</Stat.Label>
            <Stat.ValueText display="inline-block" me="2">
              {value}
            </Stat.ValueText>
            <Stat.HelpText color="fg.muted" display="inline-block">
              {isPositive ? (
                <Flex alignItems="center">
                  <Icon as={LuArrowUpRight} color="green.solid" />{" "}
                  <Box as="span" color="green.solid" fontWeight="medium">
                    {difference}
                  </Box>
                </Flex>
              ) : (
                <Flex alignItems="center">
                  <Icon as={LuArrowDownRight} color="red.solid" />{" "}
                  <Box as="span" color="red.solid" fontWeight="medium">
                    {difference}
                  </Box>
                </Flex>
              )}
            </Stat.HelpText>
          </Stat.Root>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
