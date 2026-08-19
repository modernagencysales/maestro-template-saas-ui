'use client'

import * as React from 'react'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import { getCurrentUser } from '#api'
import { useWorkspace } from '#features/common/hooks/use-workspace'

export const HomePage: React.FC = () => {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['CurrentUser'],
    queryFn: () => getCurrentUser(),
  })

  const workspace = useWorkspace()

  React.useEffect(() => {
    if (workspace) {
      router.push(`/${workspace}`)
    } else if (!isLoading && data?.currentUser?.organizations?.[0]) {
      router.push(`/${data.currentUser.organizations[0].slug}`)
    } else if (!isLoading) {
      router.push('/getting-started')
    }
  }, [router, isLoading, data, workspace])

  return (
    <LoadingOverlay.Root variant="fullscreen">
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  )
}
