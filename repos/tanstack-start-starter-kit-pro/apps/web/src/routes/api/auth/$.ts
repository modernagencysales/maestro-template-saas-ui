import { createFileRoute } from '@tanstack/react-router'

import { auth } from '@workspace/better-auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => auth.handler(request),
      POST: async ({ request }) => auth.handler(request),
    },
  },
})
