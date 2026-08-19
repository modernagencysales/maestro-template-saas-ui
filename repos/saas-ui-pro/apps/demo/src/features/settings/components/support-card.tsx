import * as React from 'react'

import {
  Card,
  LinkBox,
  LinkOverlay,
  type LinkOverlayProps,
  Stack,
  Text,
} from '@chakra-ui/react'

import { IconBadge } from '#ui/icon-badge/icon-badge'

interface SupportCardProps
  extends Omit<Card.RootProps, 'title'>,
    Pick<LinkOverlayProps, 'href'> {
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
}

export const SupportCard: React.FC<SupportCardProps> = (props) => {
  const { title, description, icon, href } = props
  return (
    <Card.Root
      variant="outline"
      size="sm"
      _hover={{ borderColor: 'border.emphasized' }}
      asChild
    >
      <LinkBox>
        <Card.Body display="flex" flexDirection="row" gap="4">
          <IconBadge icon={icon} borderRadius="full" colorPalette="gray" />
          <Stack gap="0">
            <LinkOverlay href={href} fontWeight="medium" textStyle="md">
              {title}
            </LinkOverlay>

            <Text fontSize="sm" color="fg.muted">
              {description}
            </Text>
          </Stack>
        </Card.Body>
      </LinkBox>
    </Card.Root>
  )
}
