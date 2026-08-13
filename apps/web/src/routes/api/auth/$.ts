import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async () => new Response('WorkOS auth adapter required', { status: 501 }),
      POST: async () => new Response('WorkOS auth adapter required', { status: 501 }),
    },
  },
})
