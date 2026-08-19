import { Box, Span } from '@chakra-ui/react'

import { Tag, type TagProps } from '#ui/tag/tag'

const contactTypes = {
  lead: {
    label: 'Lead',
    color: 'cyan',
  },
  customer: {
    label: 'Customer',
    color: 'purple',
  },
} as const

export const ContactType: React.FC<
  TagProps & { type?: keyof typeof contactTypes }
> = (props) => {
  const { type: typeProp, ...rest } = props
  const type = (typeProp && contactTypes[typeProp]) || contactTypes.lead
  return (
    <Tag
      size="md"
      variant="outline"
      colorPalette="gray"
      borderRadius="full"
      alignItems="center"
      h="6"
      {...rest}
    >
      <Box
        bg={`${type.color}.500`}
        boxSize="2"
        rounded="full"
        display="inline-block"
        me="1"
      />

      <Span>{type.label}</Span>
    </Tag>
  )
}
