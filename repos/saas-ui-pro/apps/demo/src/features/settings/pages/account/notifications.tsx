'use client'

import { Card, Heading, Separator, Text } from '@chakra-ui/react'

import * as GridList from '#ui/grid-list/grid-list'
import * as Section from '#ui/section/section'
import { SettingsPage } from '#components/settings-page'
import { Switch } from '#ui/switch/switch'

interface NotificationItemProps {
  title: string
  description?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
}

const NotificationItem: React.FC<NotificationItemProps> = (props) => {
  const { title, description, checked, onChange } = props
  return (
    <GridList.Item onClick={() => onChange?.(!checked)} px="3">
      <GridList.Cell flex="1" px="0" flexDirection="column">
        <Heading size="sm" fontWeight="normal">
          {title}
        </Heading>
        {description ? (
          <Text color="fg.muted" textStyle="sm">
            {description}
          </Text>
        ) : null}
      </GridList.Cell>
      <GridList.Cell>
        <Switch
          checked={checked}
          onCheckedChange={(e) => onChange?.(!!e.checked)}
          size="sm"
        />
      </GridList.Cell>
    </GridList.Item>
  )
}

function NotificationChannels() {
  const onDesktopChange = async () => {
    if (Notification.permission !== 'denied') {
      await Notification.requestPermission()
    }
  }

  return (
    <Section.Root>
      <Section.Header title="Notification channels" />
      <Section.Body>
        <Card.Root>
          <GridList.Root variant="settings">
            <NotificationItem
              title="Email"
              description="Receive a daily email digest."
              checked={true}
            />
            <NotificationItem
              title="Desktop"
              description="Receive desktop notifications."
              onChange={onDesktopChange}
            />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

function NotificationTopics() {
  return (
    <Section.Root>
      <Section.Header title="Notification topics" />
      <Section.Body>
        <Card.Root>
          <GridList.Root py="0">
            <GridList.Header>Contacts</GridList.Header>
            <NotificationItem title="A new lead is added." checked={true} />
            <NotificationItem title="An account has upgraded." checked={true} />
          </GridList.Root>
          <Separator />
          <GridList.Root py="0">
            <GridList.Header>Inbox</GridList.Header>
            <NotificationItem
              title="A message is assigned to me."
              checked={true}
            />
            <NotificationItem title="Somebody mentions me." checked={true} />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

function AccountUpdates() {
  return (
    <Section.Root>
      <Section.Header title="Account updates" />
      <Section.Body>
        <Card.Root>
          <GridList.Root>
            <NotificationItem
              title="Product updates"
              description="Receive a weekly email with all new features and updates."
              checked={true}
            />
            <NotificationItem
              title="Important updates"
              description="Receive emails about important updates like security fixes, maintenance, etc."
              checked={true}
            />
          </GridList.Root>
        </Card.Root>
      </Section.Body>
    </Section.Root>
  )
}

export function AccountNotificationsPage() {
  return (
    <SettingsPage
      title="Notifications"
      description="Manage how and where you want to be notified."
    >
      <NotificationChannels />
      <NotificationTopics />
      <AccountUpdates />
    </SettingsPage>
  )
}
