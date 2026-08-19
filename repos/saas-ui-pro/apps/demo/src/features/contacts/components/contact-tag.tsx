import { Box, Span } from '@chakra-ui/react'

import { Tag, type TagProps } from '#ui/tag/tag'

import { useTags } from '../hooks/use-tags'

export const ContactTag: React.FC<TagProps & { tag: string }> = (props) => {
  const { tag, ...rest } = props

  const { data } = useTags()

  const t = data?.tags.find((t) => t.id === tag)

  if (!t) return null

  return (
    <Tag
      size="sm"
      colorPalette="gray"
      variant="outline"
      borderRadius="full"
      h="6"
      {...rest}
    >
      <Box
        bg={t.color}
        boxSize="2"
        rounded="full"
        display="inline-block"
        me="1"
      />

      <Span>{t.label}</Span>
    </Tag>
  )
}
