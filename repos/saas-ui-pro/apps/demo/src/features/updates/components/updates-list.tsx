import { Badge, type BadgeProps, HStack, Text } from '@chakra-ui/react'
import { useSplitPage } from '@saas-ui-pro/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import * as GridList from '#ui/grid-list/grid-list'
import { Notification } from '#api'
import { DateTimeSince } from '#components/date-time'
import { useActivePath } from '#features/common/hooks/use-active-path'
import { usePath } from '#features/common/hooks/use-path'
import { Avatar } from '#ui/avatar/avatar'

const UnreadBadge: React.FC<BadgeProps> = (props) => {
  return (
    <Badge
      boxSize="2"
      minH="2"
      minW="2"
      borderRadius="full"
      colorPalette="accent"
      bg={`${props.colorScheme ?? 'colorPalette'}.solid`}
      p="0"
      {...props}
    />
  )
}

export interface UpdatesListProps extends GridList.RootProps {
  items: any[]
}

export const UpdatesList: React.FC<UpdatesListProps> = (props) => {
  const { items = [], ...rest } = props
  return (
    <GridList.Root variant="rounded" interactive {...rest}>
      {items.map((item: any, i) => (
        <UpdatesListItem key={i} item={item} />
      ))}
    </GridList.Root>
  )
}

interface UpdatesListItemProps extends GridList.ItemProps {
  item: Notification
}

const UpdatesListItem: React.FC<UpdatesListItemProps> = (props) => {
  const { item, ...rest } = props

  const router = useRouter()
  const basePath = usePath('updates')

  const { onOpen } = useSplitPage()

  const color = !item.readAt ? 'inherit' : 'fg.muted'

  const path = `${basePath}/${item.contact.id}`
  const isActive = useActivePath(path)

  return (
    <GridList.Item
      fontSize="sm"
      gap="2"
      alignItems="flex-start"
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? '' : undefined}
      onClick={() => {
        router.push(path)

        onOpen()
      }}
      {...rest}
    >
      <GridList.Cell>
        <Avatar size="sm" src={item.contact.avatar} name={item.contact.name} />
      </GridList.Cell>
      <GridList.Cell
        flex="1"
        color={color}
        display="flex"
        flexDirection="column"
        gap="0"
      >
        <HStack alignItems="center">
          {!item.readAt ? <UnreadBadge /> : null}
          <Text lineClamp={1} flex="1" asChild>
            <Link href={`/${basePath}/${item.contact.id}`}>
              {item.contact.name}
            </Link>
          </Text>
          <DateTimeSince
            date={new Date(item.date)}
            format="short"
            color="fg.muted"
            fontSize="xs"
            flexShrink="0"
          />
        </HStack>
        <HStack alignItems="flex-start">
          <Message item={item} />
        </HStack>
      </GridList.Cell>
    </GridList.Item>
  )
}

/**
 * @important dangerouslySetInnerHTML is used here to render the comment,
 * this is because the comment can contain HTML tags.
 *
 * You should make sure to sanitize the HTML before rendering it.
 *
 * @see https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml
 */
const Message = ({ item }: { item: Notification }) => {
  let message = ''
  const tags = Array.isArray(item.data?.tags) ? item.data?.tags : []

  if (item.type === 'comment' && item.data?.comment) {
    return (
      <Text fontSize="xs" lineClamp={2}>
        <Text as="span" color="inherit">
          {item.user?.name}
        </Text>{' '}
        —{' '}
        <Text
          as="span"
          color="fg.muted"
          dangerouslySetInnerHTML={{ __html: item.data.comment }}
        />
      </Text>
    )
  }

  switch (item.type) {
    case 'action':
      switch (item.data?.action) {
        case 'created-contact':
          message = 'created contact'
      }
      break
    case 'update':
      message = `updated ${item.data?.field} to ${item.data?.value}`
      break
    case 'comment':
      message = 'left a comment'
      break
    case 'tags':
      message = 'updated tags to ' + tags?.join(', ')
      break
    case 'type':
      message = `changed type to ${item.data?.type}`
      break
    case 'status':
      message = `changed status to ${item.data?.status}`
  }

  return (
    <Text fontSize="xs" color="fg.muted" lineClamp={2}>
      <Text as="span">{item.user?.name}</Text> {message}
    </Text>
  )
}
