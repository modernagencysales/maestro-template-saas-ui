'use client'

import { Alert } from '@chakra-ui/react'
import { useBilling } from '@saas-ui-pro/billing'

import { Link } from '#components/link'
import { useWorkspaceSlug } from '#features/common/hooks/use-workspace-slug'

export function PaymentOverdueBanner() {
  const workspace = useWorkspaceSlug()

  const billing = useBilling()

  if (billing?.status !== 'past_due') {
    return null
  }

  return (
    <Alert.Root status="warning" variant="solid">
      <Alert.Content alignItems="center" justifyContent="center">
        <Alert.Title>Your payment is overdue.</Alert.Title>
        <Alert.Description>
          Please update your payment information to avoid service interruption.
        </Alert.Description>

        <Link
          to="/$workspace/settings/billing"
          params={{
            workspace,
          }}
          fontWeight="semibold"
          textDecoration="underline"
        >
          Manage billing
        </Link>
      </Alert.Content>
    </Alert.Root>
  )
}
