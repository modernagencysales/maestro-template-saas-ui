import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import type { SocialProviders } from 'better-auth/social-providers'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import * as schema from '@workspace/db/auth'
import { db, userProfiles } from '@workspace/db'
import { mailer, render } from '@workspace/email'

import ConfirmEmailAddressEmail from '../../email/templates/confirm-email-address.tsx'
import ResetPasswordEmail from '../../email/templates/reset-password.tsx'
import { env } from './env.ts'

const socialProviders: SocialProviders = {}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  plugins: [tanstackStartCookies(), admin()],
  socialProviders,
  emailAndPassword: {
    enabled: true,
    // Auto sign in after sign up
    autoSignIn: true,
    // Email can be confirmed after logging in
    requireEmailVerification: false,
    sendResetPassword: async (props) => {
      if (!env.RESEND_API_KEY) {
        console.log('[Auth] Reset password request', props)
        return
      }

      const html = await render(
        ResetPasswordEmail({
          resetUrl: props.url,
          user: {
            name: props.user.name,
            email: props.user.email,
          },
          token: props.token,
        }),
      )

      mailer.send({
        to: props.user.email,
        subject: 'Reset your password',
        html,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async (props) => {
      const html = await render(
        ConfirmEmailAddressEmail({
          confirmUrl: props.url,
          token: props.token,
        }),
      )

      mailer.send({
        to: props.user.email,
        subject: 'Confirm your email address',
        html,
      })
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const locale = context?.request?.headers
            .get('accept-language')
            ?.split(',')[0]

          await db
            .insert(userProfiles)
            .values({
              id: user.id,
              locale,
            })
            .onConflictDoNothing()
            .catch((error) => {
              console.error('User profile already exists', user.id, error)
            })
        },
      },
    },
  },
})
