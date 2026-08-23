import React from 'react'

import { SimpleGrid } from '@chakra-ui/react'
import { FaGithub, FaX } from 'react-icons/fa6'

import {
  IntegrationCard,
  type IntegrationCardProps,
} from '#components/integration-card/integration-card'

const integrations: IntegrationCardProps[] = [
  {
    name: 'GitHub',
    type: 'Free integration',
    description:
      'Track activity like pushes, issues, and pull requests from a GitHub repository.',
    icon: FaGithub,
    docs: '#',
  },
  {
    name: 'X',
    type: 'Free integration',
    description:
      'Follow activity like mentions, hashtags, and retweets from specific accounts.',
    icon: FaX,
    docs: '#',
    isConnected: true,
  },
]

/** Exact Pro IntegrationCard story composition with an installed import seam. */
export const ConnectionsPage = () => {
  return (
    <SimpleGrid columns={2} gap="4">
      {integrations.map((integration) => (
        <IntegrationCard key={integration.name} {...integration} />
      ))}
    </SimpleGrid>
  )
}
