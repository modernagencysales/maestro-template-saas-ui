import { HStack, Icon, Spacer, Tag, Text } from '@chakra-ui/react'
import { LuTag } from 'react-icons/lu'

import { DataBoardHeaderProps } from '@workspace/ui/data-board'
import { OverflowMenu } from '@workspace/ui/overflow-menu'

import { ContactStatus, type ContactStatusEnum } from '../common/contact-status'
import { ContactTag } from '../common/contact-tag'
import { ContactType, type ContactTypeEnum } from '../common/contact-type'

export const ContactBoardHeader: React.FC<DataBoardHeaderProps> = (props) => {
  const value = props.groupingValue as string
  let title

  switch (props.groupingColumnId) {
    case 'status':
      title = <ContactStatus status={value as ContactStatusEnum} />
      break
    case 'tags':
      title = value ? (
        <ContactTag
          tag={value}
          px="0"
          bg="transparent"
          _dark={{ bg: 'transparent', color: 'app-text' }}
        />
      ) : (
        <Tag.Root
          size="sm"
          px="0"
          bg="transparent"
          _dark={{ bg: 'transparent', color: 'app-text' }}
        >
          <Icon as={LuTag} fontSize="sm" me="1" />
          No tag
        </Tag.Root>
      )
      break
    case 'type':
      title = (
        <ContactType
          type={value as ContactTypeEnum}
          px="0"
          bg="transparent"
          _dark={{ bg: 'transparent', color: 'app-text' }}
        />
      )
      break
  }

  return (
    <HStack w="full" py="2" px="0">
      {title}
      <Text color="muted">{(props as any).leafRows?.length ?? 0}</Text>
      <Spacer />
      <OverflowMenu.Root size="sm">
        <OverflowMenu.Item value="hide">Hide</OverflowMenu.Item>
      </OverflowMenu.Root>
    </HStack>
  )
}
