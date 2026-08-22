'use client'

import { useEffect, useMemo } from 'react'

import { BillingProvider as BillingProviderBase } from '@saas-ui-pro/billing'
import { useFeatures } from '@saas-ui-pro/feature-flags'

import { plans } from '@workspace/config'

import { useCurrentUser } from '#features/common/hooks/use-current-user'
import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'

export function BillingProvider(props: { children: React.ReactNode }) {
  const features = useFeatures()

  const [user] = useCurrentUser()
  const [workspace] = useCurrentWorkspace()

  const subscription = workspace?.subscription

  const billing = useMemo(() => {
    return {
      plans: plans,
      status: subscription?.status,
      planId: subscription?.planId,
      startedAt: subscription?.startedAt,
      trialEndsAt: subscription?.trialEndsAt ?? undefined,
      cancelAt: subscription?.cancelAt ?? undefined,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
      currentPeriodEnd: subscription?.currentPeriodEnd,
    }
  }, [subscription])

  /**
   * Identify the user in the feature flags context
   */
  useEffect(() => {
    if (user && workspace) {
      const member = workspace.members?.find((member) => member.id === user.id)

      features.identify({
        id: user.id,
        roles: member?.roles,
        plan: subscription?.planId,
      })
    }
  }, [user, workspace, subscription?.planId])

  return (
    <BillingProviderBase value={billing}>{props.children}</BillingProviderBase>
  )
}
