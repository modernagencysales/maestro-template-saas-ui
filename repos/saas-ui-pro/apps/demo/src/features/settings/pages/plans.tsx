'use client'

import { BillingPlan, useBilling } from '@saas-ui-pro/billing'

import { SettingsPage } from '#components/settings-page'
import { features, plans } from '#config'
import { PricingTable } from '#features/billing/components/pricing-table'

export function PlansPage() {
  const { planId, currentPlan } = useBilling()

  const onUpgrade = async (plan: BillingPlan) => {
    console.log(plan)
  }

  return (
    <SettingsPage
      title="Billing Plans"
      description={`You are currently on the ${currentPlan?.name} plan.`}
      contentWidth="4xl"
    >
      <PricingTable
        planId={planId}
        plans={plans}
        features={features}
        onUpdatePlan={onUpgrade}
      />
    </SettingsPage>
  )
}
