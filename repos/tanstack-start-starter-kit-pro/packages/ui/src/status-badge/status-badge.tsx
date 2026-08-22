import { Box, type BoxProps } from '@chakra-ui/react'

export const StatusBadge = (props: BoxProps) => (
  <Box
    colorPalette={props.colorPalette}
    boxSize="2"
    borderRadius="full"
    borderWidth="2px"
    borderColor="colorPalette.solid"
    bg="transparent"
    p="0"
    minW="0"
    minH="0"
    {...props}
  />
)
