import { auth } from './auth'

/**
 * Returns the session object, if the user is logged in.
 * Can be called in server components, the result is cached.
 */
export const getSession = async (req: Request) => {
  return await auth.api.getSession({ headers: req.headers })
}
