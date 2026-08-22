'use client'

import { Button, ButtonGroup } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import { FiFrown } from 'react-icons/fi'

import { EmptyState } from '#ui/empty-state/empty-state'

export default function Error() {
  const router = useRouter()

  return (
    <EmptyState
      title="Something isn't looking right"
      description="Where do you want to go?"
      icon={<FiFrown />}
      h="100dvh"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <ButtonGroup>
        <Button colorPalette="primary" onClick={() => router.back()}>
          Go back
        </Button>
        <Button onClick={() => router.push('/app')} colorPalette="accent">
          Home
        </Button>
      </ButtonGroup>
    </EmptyState>
  )
}
