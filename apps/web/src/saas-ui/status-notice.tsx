import type { ElementType, ReactNode } from "react";
import { Box, HStack, Icon, Text } from "@saas-ui/react";

export type StatusNoticeTone = "blue" | "gray" | "green" | "red" | "yellow";

export function StatusNotice({
  children,
  icon,
  title,
  tone,
}: {
  readonly children: ReactNode;
  readonly icon: ElementType;
  readonly title: string;
  readonly tone: StatusNoticeTone;
}) {
  return (
    <HStack
      align="flex-start"
      bg={`${tone}.50`}
      borderColor={`${tone}.200`}
      borderRadius="md"
      borderWidth="1px"
      gap="3"
      p="4"
    >
      <Icon as={icon} boxSize="5" color={`${tone}.600`} mt="0.5" />
      <Box>
        <Text fontWeight="semibold">{title}</Text>
        <Text color="gray.700" fontSize="sm" mt="1">
          {children}
        </Text>
      </Box>
    </HStack>
  );
}
