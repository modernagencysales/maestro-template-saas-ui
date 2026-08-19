import * as React from 'react'

import { HStack, Text } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'

import * as Menu from '#ui/menu/menu'
import * as Page from '#ui/page/page'
import { BackButton } from '#ui/back-button/back-button'

export interface OnboardingPageProps {
  isLoading?: boolean
  hideBackButton?: boolean
  children: React.ReactNode
}

export const OnboardingPage: React.FC<OnboardingPageProps> = (props) => {
  const { hideBackButton, children, ...pageProps } = props
  const { user, logOut } = useAuth()

  const nav = (
    <HStack py="1">
      {!hideBackButton && <BackButton fontSize="xs" href="/" />}
      <Menu.Root>
        <Menu.Button
          variant="ghost"
          flexDirection="column"
          alignItems="flex-start"
          textAlign="left"
          gap="0"
          py="1"
          height="auto"
        >
          <Text fontSize="xs" color="fg.muted">
            Logged in as
          </Text>
          <Text>{user?.email}</Text>
        </Menu.Button>
        <Menu.Content>
          <Menu.Item value="logout" onClick={() => logOut()}>
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </HStack>
  )

  return (
    <Page.Root bg="bg.muted" {...pageProps}>
      <Page.Header nav={nav} border="0" />
      <Page.Body maxW="full" position="relative">
        {children}
      </Page.Body>
    </Page.Root>
  )
}
