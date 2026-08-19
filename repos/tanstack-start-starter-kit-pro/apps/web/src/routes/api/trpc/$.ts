import { createFileRoute } from '@tanstack/react-router'

import { createRequestHandler } from '@workspace/api'
import { getSession } from '@workspace/better-auth'

import { createAdapters } from '#lib/trpc/adapters.ts'

function handler(request: Request) {
  const adapters = createAdapters()

  return createRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    getSession,
    adapters,
    debug: false,
  })
}

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
    },
  },
})
