import { Badge, type BadgeProps, HStack, Text } from '@chakra-ui/react'
import { useSplitPage } from '@saas-ui-pro/react'
import { Avatar, GridList } from '@saas-ui/react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'

import { DateTimeSince } from '@workspace/ui/date-time'

import type { UpdateNotification } from '../updates-adapter'

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
  items: readonly UpdateNotification[]
  workspace: string
}

export const UpdatesList: React.FC<UpdatesListProps> = (props) => {
  const { items = [], workspace, ...rest } = props
  return (
    <GridList.Root variant="rounded" interactive {...rest}>
      {items.map((item, index) => (
        <UpdatesListItem
          key={item.id ?? index}
          item={item}
          workspace={workspace}
        />
      ))}
    </GridList.Root>
  )
}

interface UpdatesListItemProps extends GridList.ItemProps {
  item: UpdateNotification
  workspace: string
}

const UpdatesListItem: React.FC<UpdatesListItemProps> = (props) => {
  const { item, workspace, ...rest } = props
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { onOpen } = useSplitPage()
  const color = !item.readAt ? 'inherit' : 'fg.muted'
  const path = `/${workspace}/updates/${item.contact.id}`
  const isActive = pathname === path

  return (
    <GridList.Item
      fontSize="sm"
      gap="2"
      alignItems="flex-start"
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? '' : undefined}
      onClick={() => {
        navigate({
          to: '/$workspace/updates/$id',
          params: { workspace, id: item.contact.id },
        })
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
            <Link
              to="/$workspace/updates/$id"
              params={{ workspace, id: item.contact.id }}
            >
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

// eslint-disable-next-line complexity -- preserves the pinned Pro demo message variants as one visible composition.
const Message = ({ item }: { item: UpdateNotification }) => {
  let message = ''
  const tags = Array.isArray(item.data?.tags) ? item.data.tags : []

  if (item.type === 'comment' && item.data?.comment) {
    return (
      <Text fontSize="xs" lineClamp={2}>
        <Text as="span" color="inherit">
          {item.user?.name}
        </Text>{' '}
        —{' '}
        <Text as="span" color="fg.muted">
          {item.data.comment}
        </Text>
      </Text>
    )
  }

  switch (item.type) {
    case 'action':
      if (item.data?.action === 'created-contact') message = 'created contact'
      break
    case 'update':
      message = `updated ${item.data?.field} to ${item.data?.value}`
      break
    case 'comment':
      message = 'left a comment'
      break
    case 'tags':
      message = `updated tags to ${tags.join(', ')}`
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
