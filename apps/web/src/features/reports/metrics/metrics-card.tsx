import { Card, Heading } from '@chakra-ui/react'

export interface MetricsCard extends Omit<Card.RootProps, 'title'> {
  title?: React.ReactNode
  noPadding?: boolean
}

export const MetricsCard: React.FC<MetricsCard> = (props) => {
  const { title, noPadding, children, ...rest } = props
  const bodyProps = noPadding ? { px: 0 } : {}
  return (
    <Card.Root {...rest}>
      {title && (
        <Card.Header>
          <Heading as="h3" size="sm" fontWeight="medium">
            {title}
          </Heading>
        </Card.Header>
      )}
      <Card.Body pt="0" {...bodyProps}>
        {children}
      </Card.Body>
    </Card.Root>
  )
}
