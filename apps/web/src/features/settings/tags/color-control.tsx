import { Box, Stack } from "@chakra-ui/react";
import { IconButton, Popover } from "@saas-ui/react";
import { LuCheck } from "react-icons/lu";

import { useOpenState } from "#hooks/use-open-state";

interface ColorControlProps {
  colors: string[];
  onChange(color: string): void;
  value?: string;
}

export function ColorControl({ colors, onChange, value }: ColorControlProps) {
  const openState = useOpenState();

  const swatches = colors.map((color) => (
    <IconButton
      aria-label={`Select color ${color}`}
      onClick={() => onChange(color)}
      variant="plain"
      rounded="full"
      size="xs"
      key={color}
      bg={`colors.tag.${color}`}
      opacity="0.8"
      color="white"
      _selected={{
        opacity: "1",
        _hover: {
          bg: color,
        },
      }}
      _hover={{
        opacity: "1",
        outline: "2px solid",
        outlineOffset: "1px",
        outlineColor: `colors.tag.${color}`,
      }}
      data-selected={value === color ? "" : undefined}
    >
      {value === color && <LuCheck size="1.2em" />}
    </IconButton>
  ));

  return (
    <Popover.Root
      open={openState.open}
      onOpenChange={openState.onOpenChange}
      positioning={{
        placement: "bottom",
      }}
      lazyMount
    >
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Change primary color"
          variant="outline"
          bg="bg.panel"
          size="sm"
          onClick={() => openState.setOpen(!openState.open)}
        >
          <Box rounded="full" boxSize="2.5" bg={value} />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content width="auto">
        <Stack gap="2" flexDirection="row" p="2">
          {swatches}
        </Stack>
      </Popover.Content>
    </Popover.Root>
  );
}
