import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: async () => new Response('Convex adapter required', { status: 501 }),
      POST: async () => new Response('Convex adapter required', { status: 501 }),
    },
  },
})
