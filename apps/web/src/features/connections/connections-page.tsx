import React from 'react'

import { SimpleGrid } from '@chakra-ui/react'
import { useConvexQuery } from '@convex-dev/react-query'
import {
  getFunctionReference,
  templateConfectRefs,
} from '@maestro-template/convex/refs'
import { useMutation as useConvexMutation } from 'convex/react'
import { IntegrationCard } from '#components/integration-card/integration-card'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { isFixtureAuthRuntime } from '#lib/auth/route-auth'

import {
  connectionFixtures,
  projectDurableConnectionStatus,
  transitionConnectionStatus,
  type ConnectionCardModel,
  type ConnectionStatus,
  type DurableConnection,
} from './connections-adapter'

const listConnectionsRef = getFunctionReference(
  templateConfectRefs.public.integrations.connections.list,
)
const beginConnectionRef = getFunctionReference(
  templateConfectRefs.public.integrations.connections.begin,
)
const revokeConnectionRef = getFunctionReference(
  templateConfectRefs.public.integrations.connections.revoke,
)

/** Exact Pro IntegrationCard story composition with an installed import seam. */
export const ConnectionsPage = () => {
  const [workspace] = useCurrentWorkspace()
  const fixtureRuntime = isFixtureAuthRuntime()
  const durableConnections = useConvexQuery(
    listConnectionsRef,
    fixtureRuntime ? 'skip' : { workspaceId: workspace.id },
  )
  const beginConnection = useConvexMutation(beginConnectionRef)
  const revokeConnection = useConvexMutation(revokeConnectionRef)
  const liveConnections = (durableConnections?.data ?? []) as readonly DurableConnection[]
  const [statuses, setStatuses] = React.useState<
    Record<string, ConnectionStatus>
  >(() =>
    Object.fromEntries(
      connectionFixtures.map(({ id, status }) => [id, status]),
    ),
  )

  const transition = async (
    id: ConnectionCardModel['id'],
    event: 'connect' | 'disconnect',
  ) => {
    if (!fixtureRuntime) {
      if (event === 'connect') {
        await beginConnection({ workspaceId: workspace.id, provider: id })
        return
      }
      const current = liveConnections.find(
        (connection) => connection.provider === id,
      )
      if (current !== undefined) {
        await revokeConnection({
          workspaceId: workspace.id,
          provider: id,
          generation: current.generation,
        })
      }
      return
    }
    setStatuses((current) => ({
      ...current,
      [id]: transitionConnectionStatus(current[id] ?? 'available', event),
    }))
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
      {connectionFixtures.map((integration) => (
        (() => {
          const status = fixtureRuntime
            ? (statuses[integration.id] ?? 'available')
            : projectDurableConnectionStatus(
                liveConnections.find(
                  (connection) => connection.provider === integration.id,
                ),
              )
          return (
        <IntegrationCard
          key={integration.id}
          {...integration}
          type={
            status === 'connected'
              ? 'Connected'
              : status === 'connecting'
                ? 'Connecting'
                : status === 'error'
                  ? 'Connection needs attention'
                  : 'Available integration'
          }
          isConnected={status === 'connected'}
          onConnect={() => transition(integration.id, 'connect')}
          onDisconnect={() => transition(integration.id, 'disconnect')}
          onDocs={() => window.open(integration.docs, '_blank', 'noopener')}
        />
          )
        })()
      ))}
    </SimpleGrid>
  )
}
