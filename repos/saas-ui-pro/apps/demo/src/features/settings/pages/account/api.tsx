'use client'

import { Button, Text, useClipboard } from '@chakra-ui/react'
import { useMutation } from '@tanstack/react-query'
import { LuCheck, LuCopy, LuX } from 'react-icons/lu'

import * as GridList from '#ui/grid-list/grid-list'
import * as Section from '#ui/section/section'
import { Link } from '#components/link'
import { useModals } from '#components/modals'
import { SettingsPage } from '#components/settings-page'
import { SettingsCard } from '#features/settings/components/settings-card'
import { IconButton } from '#ui/icon-button/icon-button'

function AccessToken({
  token,
  onRemove,
}: {
  token: string
  onRemove: (token: string) => void
}) {
  const { value, copy, copied } = useClipboard({
    value: token,
  })

  const handleRemove = () => {
    onRemove?.(token)
  }

  return (
    <GridList.Item onClick={copy}>
      <GridList.Cell flex="1">
        <Text>{value}</Text>
      </GridList.Cell>
      <GridList.Cell px="4">{copied ? <LuCheck /> : <LuCopy />}</GridList.Cell>
      <GridList.Cell>
        <IconButton
          aria-label="Remove access token"
          variant="ghost"
          onClick={handleRemove}
        >
          <LuX />
        </IconButton>
      </GridList.Cell>
    </GridList.Item>
  )
}

function PersonalAccessTokens() {
  const modals = useModals()

  const mutation = useMutation<void, Error, { token: string }>({
    mutationFn: async ({ token }) => {
      await Promise.resolve()
    },
  })

  const onRemove = (token: string) => {
    modals.confirm({
      title: 'Remove access token',
      description: 'Are you sure you want to remove this access token?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      onConfirm: () => {
        mutation.mutate({
          token,
        })
      },
    })
  }

  return (
    <Section.Root>
      <Section.Header
        title="Access tokens"
        description={<Section.Description></Section.Description>}
      />
      <Section.Body>
        <SettingsCard
          footer={<Button variant="glass">Create new token</Button>}
        >
          <GridList.Root p="0">
            <AccessToken token="12345" onRemove={onRemove} />
          </GridList.Root>
        </SettingsCard>
      </Section.Body>
    </Section.Root>
  )
}

export function AccountApiPage() {
  return (
    <SettingsPage
      title="API access"
      description={
        <Text color="fg.muted" textStyle="md">
          Use access tokens to access the API.{' '}
          <Link href="#">Read documentation</Link>
        </Text>
      }
    >
      <PersonalAccessTokens />
    </SettingsPage>
  )
}
