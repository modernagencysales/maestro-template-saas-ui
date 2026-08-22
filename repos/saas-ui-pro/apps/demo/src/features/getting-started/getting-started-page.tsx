'use client'

import * as React from 'react'

import { Center, Container, defineSlotRecipe } from '@chakra-ui/react'
import { useSessionStorageValue } from '@react-hookz/web'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'
import * as Steps from '#ui/steps/steps'
import { getCurrentUser } from '#api'

import {
  CreateWorkspaceStep,
  InviteTeamMembersStep,
  OnboardingPage,
} from './components'
import { AppearanceStep } from './components/appearance'
import { SubscribeStep } from './components/subscribe'

const recipe = defineSlotRecipe({
  className: 'steps',
  slots: ['root', 'list', 'item', 'indicator', 'title'],
  variants: {
    variant: {
      dots: {
        list: {
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
        },
        indicator: {
          boxSize: 2,
          overflow: 'hidden',
          bg: 'colorPalette.subtle',
          rounded: 'full',
          _current: {
            bg: 'colorPalette.solid',
          },
          '& *': {
            display: 'none',
          },
        },
        title: {
          display: 'none',
        },
      },
    },
  },
})

export const GettingStartedPage: React.FC = () => {
  const { isLoading } = useQuery({
    queryKey: ['CurrentUser'],
    queryFn: () => getCurrentUser(),
  })

  return (
    <OnboardingPage isLoading={isLoading}>
      <Container maxW="6xl">
        <Center minH="calc(100dvh - 100px)">
          <Steps.Root
            variant={'dots' as any}
            recipe={recipe}
            defaultStep={0}
            count={4}
            width="full"
          >
            <OnboardingSteps />

            <Steps.List>
              <Steps.Item index={0} title="Create organization" />
              <Steps.Item index={1} title="Choose your style" />
              <Steps.Item index={2} title="Invite team members" />
              <Steps.Item index={3} title="Subscribe to updates" />
            </Steps.List>
          </Steps.Root>
        </Center>
      </Container>
    </OnboardingPage>
  )
}

function OnboardingSteps() {
  const stepper = Steps.useContext()

  return (
    <>
      <Steps.Content index={0} title="Create organization">
        {stepper.value === 0 && <CreateWorkspaceStep />}
      </Steps.Content>
      <Steps.Content index={1} title="Choose your style">
        {stepper.value === 1 && <AppearanceStep />}
      </Steps.Content>
      <Steps.Content index={2} title="Invite team members">
        {stepper.value === 2 && <InviteTeamMembersStep />}
      </Steps.Content>
      <Steps.Content index={3} title="Subscribe to updates">
        {stepper.value === 3 && <SubscribeStep />}
      </Steps.Content>

      <Steps.CompletedContent>
        {stepper.percent === 100 && <OnboardingCompleted />}
      </Steps.CompletedContent>
    </>
  )
}

const OnboardingCompleted = () => {
  const router = useRouter()
  const workspace = useSessionStorageValue('getting-started.workspace')

  return (
    <LoadingOverlay.Root
      bg="bg"
      ref={() => {
        router.push(`/${workspace.value}`)
      }}
    >
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  )
}
