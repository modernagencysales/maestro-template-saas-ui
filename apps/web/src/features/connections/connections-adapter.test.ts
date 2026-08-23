import { describe, expect, it } from 'vitest'

import {
  connectionFixtures,
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
})
