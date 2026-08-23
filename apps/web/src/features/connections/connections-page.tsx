import React from 'react'

import { SimpleGrid } from '@chakra-ui/react'
import { IntegrationCard } from '#components/integration-card/integration-card'

import {
  connectionFixtures,
  transitionConnectionStatus,
  type ConnectionStatus,
} from './connections-adapter'

/** Exact Pro IntegrationCard story composition with an installed import seam. */
export const ConnectionsPage = () => {
  const [statuses, setStatuses] = React.useState<
    Record<string, ConnectionStatus>
  >(() =>
    Object.fromEntries(
      connectionFixtures.map(({ id, status }) => [id, status]),
    ),
  )

  const transition = (
    id: string,
    event: 'connect' | 'disconnect',
  ) => {
    setStatuses((current) => ({
      ...current,
      [id]: transitionConnectionStatus(current[id] ?? 'available', event),
    }))
  }

  return (
    <SimpleGrid columns={2} gap="4">
      {connectionFixtures.map((integration) => (
        <IntegrationCard
          key={integration.id}
          {...integration}
          type={
            statuses[integration.id] === 'connected'
              ? 'Connected'
              : 'Available integration'
          }
          isConnected={statuses[integration.id] === 'connected'}
          onConnect={() => transition(integration.id, 'connect')}
          onDisconnect={() => transition(integration.id, 'disconnect')}
          onDocs={() => window.open(integration.docs, '_blank', 'noopener')}
        />
      ))}
    </SimpleGrid>
  )
}
