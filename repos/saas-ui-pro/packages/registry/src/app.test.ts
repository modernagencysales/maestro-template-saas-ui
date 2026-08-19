import { describe, expect, it } from 'vitest'

import { createRegistryApp } from './app.js'

const privateItemUrl =
  'http://localhost/r/styles/default/task-card-with-labels.json'
const publicItemUrl = 'http://localhost/r/styles/default/user-menu.json'

const app = createRegistryApp({
  verifyAccessToken: async (token) => token === 'valid-token',
})

describe('registry authorization', () => {
  it('serves the canonical shared schema and compatibility alias', async () => {
    const [canonical, compatibility] = await Promise.all([
      app.request('http://localhost/r/schema/registry.json'),
      app.request('http://localhost/r/schema.json'),
    ])

    expect(canonical.status).toBe(200)
    expect(compatibility.status).toBe(200)
    expect(canonical.headers.get('Cache-Control')).toBe('max-age=3600')
    const canonicalSchema = await canonical.json()
    expect(canonicalSchema).toMatchObject({
      $id: 'https://registry.saas-ui.dev/r/schema/registry.json',
      'x-registry-schema-version': 1,
    })
    expect(await compatibility.json()).toEqual(canonicalSchema)
  })

  it('validates registry payloads before trusting private metadata', async () => {
    let verifierCalled = false
    const malformedApp = createRegistryApp({
      loadRegistryItem: async () => ({ private: false }),
      verifyAccessToken: async () => {
        verifierCalled = true
        return true
      },
    })

    const response = await malformedApp.request(publicItemUrl)

    expect(response.status).toBe(500)
    expect(verifierCalled).toBe(false)
  })

  it('requires bearer credentials for private registry payloads', async () => {
    const response = await app.request(privateItemUrl)

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer')
  })

  it('rejects non-bearer authorization schemes', async () => {
    const response = await app.request(privateItemUrl, {
      headers: { Authorization: 'Basic credentials' },
    })

    expect(response.status).toBe(401)
  })

  it('prevents authenticated payloads from being cached', async () => {
    const response = await app.request(privateItemUrl, {
      headers: { Authorization: 'Bearer valid-token' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Authorization')
  })

  it('rejects invalid bearer credentials', async () => {
    const response = await app.request(privateItemUrl, {
      headers: { Authorization: 'Bearer invalid-token' },
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe('Authorization')
  })

  it('serves public registry payloads without credentials', async () => {
    const response = await app.request(publicItemUrl)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('max-age=3600')
  })
})
