import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { GettingStartedPage } from '#features/getting-started'

export const Route = createFileRoute('/_app/getting-started/')({
  validateSearch: z.object({
    workspace: z.string().optional(),
  }),
  head: () => ({
    meta: [
      {
        title: 'Getting Started',
      },
    ],
  }),
  component: GettingStartedPage,
})
