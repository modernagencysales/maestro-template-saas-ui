import * as React from "react";

import { Box, Button, Card, Flex, Icon } from "@chakra-ui/react";
import {
  LuArrowDownRight,
  LuArrowUpRight,
  LuChevronRight,
  LuMousePointer,
  LuUsers,
  LuWallet,
} from "react-icons/lu";

import * as Stat from "@/components/ui/stat/stat";
import { IconBadge } from "@/components/ui/icon-badge/icon-badge";

const getIcon = (metric: string) => {
  switch (metric) {
    case "active-users":
      return <LuUsers />;
    case "sales":
      return <LuWallet />;
    case "avg-click-rate":
      return <LuMousePointer />;
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
    <Card.Root flex="1" overflow="clip">
      <Card.Body position="relative">
        <Stat.Root gap="0">
          <Stat.Label>{label}</Stat.Label>
          <Stat.ValueText>{value}</Stat.ValueText>
          <Stat.HelpText color="fg.muted">
            {isPositive ? (
              <Flex alignItems="center" gap="1">
                <Icon as={LuArrowUpRight} color="green.solid" />{" "}
                <Box as="span" color="green.solid" fontWeight="medium">
                  {difference}
                </Box>
                more than last week
              </Flex>
            ) : (
              <Flex alignItems="center" gap="1">
                <Icon as={LuArrowDownRight} color="red.solid" />{" "}
                <Box as="span" color="red.solid" fontWeight="medium">
                  {difference}
                </Box>
                less than last week
              </Flex>
            )}
          </Stat.HelpText>
          <IconBadge
            colorPalette="gray"
            position="absolute"
            top="0"
            right="0"
            size="lg"
            variant="outline"
          >
            {getIcon(id)}
          </IconBadge>
        </Stat.Root>
      </Card.Body>
      <Button
        justifyContent="flex-end"
        borderTopRadius="0"
        fontWeight="medium"
        boxShadow="none"
        borderWidth="0"
        h="8"
        px="4"
        bg="gray.muted"
        _hover={{ bg: "gray.subtle" }}
      >
        View reports
        <LuChevronRight />
      </Button>
    </Card.Root>
  );
};
