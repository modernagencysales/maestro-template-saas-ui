import { Box, Card, Heading, Icon, Stack, Text } from '@chakra-ui/react'

interface SettingsCardProps extends Omit<Card.RootProps, 'title'> {
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  avatar?: React.ReactNode
  footer?: React.ReactNode
}

export const SettingsCard: React.FC<SettingsCardProps> = (props) => {
  const { title, description, footer, avatar, icon, children, ...rest } = props
  const showHeader = title || description || avatar || icon
  return (
    <Card.Root {...rest}>
      {showHeader ? (
        <Card.Header display="flex" px="4" py="3">
          <Box mr="4">{icon ? <Icon boxSize="8">{icon}</Icon> : avatar}</Box>
          <Stack gap="1">
            <Heading as="h3" size="sm">
              {title}
            </Heading>

            <Text fontSize="sm" color="muted">
              {description}
            </Text>
          </Stack>
        </Card.Header>
      ) : null}
      {children}
      <Card.Footer px="4" py="3" justifyContent="flex-end" borderTopWidth="1px">
        {footer}
      </Card.Footer>
    </Card.Root>
  )
}
