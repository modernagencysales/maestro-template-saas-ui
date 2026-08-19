import {
  type AccessTokenVerifier,
  createSupabaseAccessTokenVerifier,
  isRegistryRequestAuthorized,
} from '@saas-ui/registry/auth'
import { type RegistryItem, parseRegistryItem } from '@saas-ui/registry/schema'
import { type Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'

const defaultHeaders = {
  headers: {
    'Cache-Control': 'max-age=3600',
  },
}

const privateHeaders = {
  headers: {
    'Cache-Control': 'private, no-store',
    Vary: 'Authorization',
  },
}

const basePath = process.env.BASE_PATH ?? '/r'

interface RegistryAppOptions {
  verifyAccessToken?: AccessTokenVerifier
  loadRegistryItem?: (style: string, component: string) => Promise<unknown>
}

const defaultVerifyAccessToken = createSupabaseAccessTokenVerifier({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
})

async function loadRegistryItem(style: string, component: string) {
  const file = await import(`../public/r/styles/${style}/${component}`, {
    with: { type: 'json' },
  })

  return file.default as unknown
}

async function authorize(c: Context, verifyAccessToken: AccessTokenVerifier) {
  c.header('Cache-Control', 'private, no-store')
  c.header('Vary', 'Authorization')

  const authorized = await isRegistryRequestAuthorized(
    c.req.header('Authorization'),
    verifyAccessToken,
  )

  if (!authorized) {
    c.header('WWW-Authenticate', 'Bearer')
    throw new HTTPException(401, {
      message: 'Unauthorized',
    })
  }
}

export function createRegistryApp(options: RegistryAppOptions = {}) {
  const app = new Hono()
  const verifyAccessToken =
    options.verifyAccessToken ?? defaultVerifyAccessToken
  const loadItem = options.loadRegistryItem ?? loadRegistryItem

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET'],
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  if (process.env.NODE_ENV !== 'production') {
    app.use('*', (c, next) => {
      console.log('[req]', c.req.url)
      return next()
    })
  }

  const registrySchema = async (c: Context) => {
    const file = await import('../public/r/schema/registry.json', {
      with: { type: 'json' },
    })
    return c.json(file.default, defaultHeaders)
  }

  app.get(`${basePath}/schema/registry.json`, registrySchema)
  app.get(`${basePath}/schema.json`, registrySchema)

  app.get(`${basePath}/index.json`, async (c) => {
    const file = await import('../public/r/index.json', {
      with: { type: 'json' },
    })
    return c.json(file.default, defaultHeaders)
  })

  app.get(`${basePath}/styles/index.json`, async (c) => {
    const file = await import('../public/r/styles/index.json', {
      with: { type: 'json' },
    })
    return c.json(file.default, defaultHeaders)
  })

  app.get(`${basePath}/styles/:style/:component{.+\\.json$}`, async (c) => {
    const { style, component } = c.req.param()
    const content: RegistryItem = parseRegistryItem(
      await loadItem(style, component),
      `registry item ${style}/${component}`,
    )

    if (content.private) {
      await authorize(c, verifyAccessToken)

      return c.json(content, privateHeaders)
    }

    return c.json(content, defaultHeaders)
  })

  return app
}

const app = createRegistryApp()

export default app
