import { Box, Text } from '@chakra-ui/react'
import { useBilling } from '@saas-ui-pro/billing'
import { addDays } from 'date-fns'

import { FormattedDate } from '@workspace/i18n'

export function BillingStatus() {
  const {
    isTrialing,
    isTrialExpired,
    trialEndsAt,
    currentPeriodEnd,
    currentPlan,
  } = useBilling()

  const renewalDate = currentPeriodEnd
    ? addDays(currentPeriodEnd, 1)
    : undefined

  return (
    <Box textStyle="sm" color="fg.muted">
      {!isTrialExpired && (
        <Text>
          You are currently on the <strong>{currentPlan?.name}</strong> plan.{' '}
          {renewalDate && (
            <>
              Renews at <FormattedDate value={renewalDate} />.
            </>
          )}
        </Text>
      )}

      {isTrialing && (
        <Text>
          Your trial ends <FormattedDate value={trialEndsAt} />.
        </Text>
      )}

      {isTrialExpired && (
        <Text>
          Your trial ended on <FormattedDate value={trialEndsAt} />.
        </Text>
      )}
    </Box>
  )
}
