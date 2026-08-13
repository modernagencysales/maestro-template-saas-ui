import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async () => new Response('Billing webhook adapter required', { status: 501 }),
    },
  },
})
