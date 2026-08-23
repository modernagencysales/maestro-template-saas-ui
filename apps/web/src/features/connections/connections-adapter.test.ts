import { describe, expect, it } from 'vitest'

import {
  connectionFixtures,
  projectDurableConnectionStatus,
  transitionConnectionStatus,
} from './connections-adapter'

describe('Connections IntegrationCard adapter', () => {
  it('ships Maestro-relevant providers instead of upstream demo products', () => {
    expect(connectionFixtures.map(({ name }) => name)).toEqual([
      'Slack',
      'Google Drive',
      'HubSpot',
    ])
  })

  it('models connect and disconnect without changing the Pro card structure', () => {
    expect(transitionConnectionStatus('available', 'connect')).toBe(
      'connected',
    )
    expect(transitionConnectionStatus('connected', 'disconnect')).toBe(
      'available',
    )
  })

  it('projects durable backend states into the Pro card states', () => {
    expect(
      projectDurableConnectionStatus({
        provider: 'slack',
        status: 'verifying',
        generation: 2,
      }),
    ).toBe('connecting')
    expect(
      projectDurableConnectionStatus({
        provider: 'slack',
        status: 'active',
        generation: 2,
      }),
    ).toBe('connected')
    expect(projectDurableConnectionStatus(undefined)).toBe('available')
  })
})
