'use client'

import React from 'react'

import { useAuth } from '@saas-ui/auth-provider'
import { useRouter } from 'next/navigation'

import { AuthLayout as BaseAuthLayout } from '#features/common/layouts/auth-layout'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated])

  return <BaseAuthLayout>{children}</BaseAuthLayout>
}
