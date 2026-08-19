'use client'

import { Card, GridList, Section, toast } from '@saas-ui/react'
import { LuChevronRight } from 'react-icons/lu'

import { useModals } from '@workspace/ui/modals'
import { SettingsPage } from '@workspace/ui/settings-page'

import { api } from '#lib/trpc/react'

import { UpdatePasswordDialog } from './update-password-dialog'

function TwoFactorAuthItem() {
  return (
    <GridList.Item>
      <GridList.Cell flex="1">Two-factor authentication</GridList.Cell>
      <GridList.Cell px="4">Enable</GridList.Cell>
    </GridList.Item>
  )
}

function PasswordListItem({ lastChanged }: { lastChanged: Date | null }) {
  const modals = useModals()

  return (
    <GridList.Item
      onClick={() => {
        const id = modals.open(UpdatePasswordDialog, {
          title: 'Update your password',
          isCentered: true,
          onSuccess() {
            toast.success({
              title: 'Your password has been updated',
            })
            modals.close(id)
          },
          onError(error: any) {
            toast.error({
              title: error.message,
            })
          },
        })
      }}
    >
      <GridList.Cell flex="1">Password</GridList.Cell>
      {lastChanged && (
        <GridList.Cell color="muted" px="4">
          Last changed {lastChanged.toLocaleDateString()}
        </GridList.Cell>
      )}
      <GridList.Cell>
        <LuChevronRight />
      </GridList.Cell>
    </GridList.Item>
  )
}

function AccountSignIn() {
  const { data } = api.auth.listAccounts.useQuery()

  const authAccount = data?.find(
    (account) => account.providerId === 'credential',
  )

  return (
    <Section.Root>
      <Section.Header
        title="Signing in"
        description="Update your password and improve account security."
      />
      <Section.Body>
        <Card.Root>
          <GridList.Root interactive>
            {authAccount && (
              <PasswordListItem lastChanged={authAccount.updatedAt} />
            )}

            <TwoFactorAuthItem />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

export function AccountSecurityPage() {
  return (
    <SettingsPage title="Security" description="Manage your account security">
      <AccountSignIn />
    </SettingsPage>
  )
}
