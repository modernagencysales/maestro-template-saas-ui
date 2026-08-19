'use client'

import { useAuth } from '@saas-ui/auth-provider'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import { HomePage } from '#features/organizations/pages/home-page'

export const IndexPage = () => {
  const { isAuthenticated, isLoggingIn } = useAuth()

  if (isLoggingIn) {
    return (
      <LoadingOverlay.Root variant="fullscreen">
        <LoadingOverlay.Spinner />
      </LoadingOverlay.Root>
    )
  }

  if (isAuthenticated) {
    return <HomePage />
  }
}
