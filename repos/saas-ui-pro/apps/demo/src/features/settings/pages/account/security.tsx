'use client'

import { Card } from '@chakra-ui/react'
import { LuChevronRight } from 'react-icons/lu'

import * as GridList from '#ui/grid-list/grid-list'
import * as Section from '#ui/section/section'
import { useModals } from '#components/modals'
import { SettingsPage } from '#components/settings-page'
import { toast } from '#ui/toaster/toaster'

import { UpdatePasswordDialog } from '../../components/update-password-dialog'

function TwoFactorAuthItem() {
  return (
    <GridList.Item onClick={() => null}>
      <GridList.Cell flex="1">Two-factor authentication</GridList.Cell>
      <GridList.Cell color="muted" px="4">
        Not enabled
      </GridList.Cell>
      <GridList.Cell>
        <LuChevronRight />
      </GridList.Cell>
    </GridList.Item>
  )
}

function PasswordListItem() {
  const modals = useModals()

  return (
    <GridList.Item
      onClick={() => {
        const id = modals.open({
          title: 'Update your password',
          component: UpdatePasswordDialog,
          onSuccess() {
            toast.success({
              title: 'Your password has been updated.',
            })
            modals.close(id)
          },
        })
      }}
    >
      <GridList.Cell flex="1">Password</GridList.Cell>
      <GridList.Cell color="muted" px="4">
        Last changed January 1st 2022
      </GridList.Cell>
      <GridList.Cell>
        <LuChevronRight />
      </GridList.Cell>
    </GridList.Item>
  )
}

function AccountSignIn() {
  return (
    <Section.Root>
      <Section.Header
        title="Signing in"
        description="Update your password and improve account security."
      />
      <Section.Body>
        <Card.Root>
          <GridList.Root variant="settings">
            <PasswordListItem />
            <TwoFactorAuthItem />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

export function AccountSecurityPage() {
  return (
    <SettingsPage
      title="Security"
      description="Manage your account security"
      loading={false}
    >
      <AccountSignIn />
    </SettingsPage>
  )
}
