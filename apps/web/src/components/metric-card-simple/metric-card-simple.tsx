import * as React from "react";

import { Box, Card, Flex, Icon } from "@chakra-ui/react";
import { LuArrowDownRight, LuArrowUpRight } from "react-icons/lu";

import * as Stat from "@/components/ui/stat/stat";

export interface MetricCardProps {
  label: string;
  value: string;
  difference: string;
  isPositive: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = (props) => {
  const { label, value, difference, isPositive } = props;
  return (
    <Card.Root flex="1">
      <Card.Body position="relative">
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
      </Card.Body>
    </Card.Root>
  );
};
