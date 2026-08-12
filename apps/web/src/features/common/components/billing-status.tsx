export const BillingStatus = () => {
  // Billing is intentionally a neutral fixture seam in the reference app.
  return null;
  /*

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
*/
};
