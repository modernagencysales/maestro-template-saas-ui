'use client'

import type { User } from 'better-auth'
import { createAuthClient } from 'better-auth/react'
import type { SocialProvider } from 'better-auth/social-providers'

export { adminClient } from 'better-auth/client/plugins'
export { createAuthClient } from 'better-auth/react'

type AuthService<TUser> = {
  onLogin: (
    params: {
      provider?: string
      email?: string
      password?: string
    },
    options?: {
      redirectTo?: string
    },
  ) => Promise<TUser | null>
  onSignup: (
    params: {
      provider?: string
      name?: string
      email?: string
      password?: string
    },
    options?: {
      redirectTo?: string
    },
  ) => Promise<void | TUser | null>
  onResetPassword: (
    params: { email: string },
    options?: {
      redirectTo?: string
    },
  ) => Promise<unknown>
  onUpdatePassword: (params: {
    password: string
    newPassword?: string
    token?: string
  }) => Promise<void>
  onLogout: () => Promise<unknown>
  onLoadUser: () => Promise<TUser | null>
}

export function createAuthService(client: ReturnType<typeof createAuthClient>) {
  return {
    onLogin: async (
      params: {
        provider?: string
        email?: string
        password?: string
      },
      options?: {
        redirectTo?: string
      },
    ) => {
      const redirectTo = options?.redirectTo ?? '/'

      if (params.provider) {
        await client.signIn.social({
          provider: params.provider as SocialProvider,
          callbackURL: redirectTo,
        })
        return null
      } else if (params.email && params.password) {
        const { data, error } = await client.signIn.email({
          email: params.email,
          password: params.password,
        })

        if (error) {
          throw new Error('Invalid email or password', {
            cause: error,
          })
        }

        return data.user
      }

      throw new Error('Invalid parameters')
    },
    onSignup: async (
      params: {
        provider?: string
        name?: string
        email?: string
        password?: string
      },
      options?: {
        redirectTo?: string
      },
    ) => {
      const redirectTo = options?.redirectTo ?? '/'

      if (params.provider) {
        await client.signIn.social({
          provider: params.provider as SocialProvider,
          callbackURL: redirectTo,
        })
        return null
      } else if (params.email && params.password) {
        const { error } = await client.signUp.email({
          email: params.email,
          name: params.name ?? '',
          password: params.password,
          callbackURL: redirectTo,
        })

        if (error) {
          throw new Error('Invalid email or password', {
            cause: error,
          })
        }

        // If there is no error, we can assume the user is signed up
        // auto login is enabled by default, so the user will be redirected
        // to the dashboard.
        return
      }

      throw new Error('Invalid parameters')
    },
    onResetPassword: async (
      params: { email: string },
      options?: {
        redirectTo?: string
      },
    ) => {
      const { data, error } = await client.requestPasswordReset({
        email: params.email,
        redirectTo: options?.redirectTo ?? '/',
      })

      if (error) {
        throw new Error('Could not send reset email', {
          cause: error,
        })
      }

      return data
    },
    onUpdatePassword: async (params: {
      password: string
      newPassword?: string
      token?: string
    }) => {
      if (params.token) {
        const { error } = await client.resetPassword({
          newPassword: params.password,
          token: params.token,
        })

        if (error) {
          const message =
            error.code === 'INVALID_TOKEN'
              ? 'Token is invalid or expired'
              : 'Could not reset password'

          throw new Error(message, {
            cause: error,
          })
        }
      } else {
        if (!params.newPassword) {
          throw new Error('New password is required')
        }

        const { error } = await client.changePassword({
          currentPassword: params.password,
          newPassword: params.newPassword,
        })

        if (error) {
          if (error.code === 'INVALID_PASSWORD') {
            throw new Error('Invalid current password', {
              cause: error,
            })
          }

          throw new Error(error.message, {
            cause: error,
          })
        }
      }
    },
    onLogout: async () => {
      return await client.signOut()
    },
    onLoadUser: async () => {
      const session = await client.getSession()

      return session?.data?.user ?? null
    },
  } satisfies AuthService<User>
}
