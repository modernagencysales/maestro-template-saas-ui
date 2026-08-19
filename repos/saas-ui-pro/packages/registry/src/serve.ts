import { serve } from '@hono/node-server'

import app from './app.js'

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? '4000'),
    hostname: process.env.HOST ?? 'localhost',
  },
  (info) => {
    console.log(`Registry: http://${info.address}:${info.port}`)
  },
)
