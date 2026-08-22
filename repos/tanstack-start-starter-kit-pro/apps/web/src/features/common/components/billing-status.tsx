import { Card, Progress, Stack, Text } from '@chakra-ui/react'
import { useBilling } from '@saas-ui-pro/billing'
import { Has } from '@saas-ui-pro/feature-flags'
import { differenceInDays, formatDistanceStrict } from 'date-fns'

import { LinkButton } from '#components/link-button'

import { useWorkspaceSlug } from '../hooks/use-workspace-slug'

export const BillingStatus = () => {
  const workspace = useWorkspaceSlug()
  const { isTrialing, trialEndsAt, currentPlan } = useBilling()

  if (!isTrialing || !currentPlan || !trialEndsAt) {
    return null
  }

  let progress = 0
  if (currentPlan.trialDays) {
    progress =
      100 -
      (100 / currentPlan.trialDays) * differenceInDays(trialEndsAt, new Date())
  }

  let message
  if (progress > 100) {
    message = <Text flex="1">Your trial has ended</Text>
  } else {
    message = (
      <Text flex="1">
        Trial ends in{' '}
        <strong>{formatDistanceStrict(new Date(), trialEndsAt)}</strong>
      </Text>
    )
  }

  return (
    <Card.Root position="relative" overflow="hidden">
      <Card.Body>
        <Stack direction="row" alignItems="center">
          {message}
          <Has feature="billing">
            <LinkButton
              to="/$workspace/settings/billing"
              params={{
                workspace,
              }}
              size="xs"
            >
              Upgrade
            </LinkButton>
          </Has>
        </Stack>
        {progress !== undefined && (
          <Progress.Root
            position="absolute"
            bottom="0"
            right="0"
            left="0"
            colorPalette="green"
            size="xs"
            borderRadius="0"
            value={progress}
          >
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}
