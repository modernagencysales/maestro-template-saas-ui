'use client'

import { Container, Heading, Stack } from '@chakra-ui/react'
import { Button, EmptyState, LoadingOverlay, toast } from '@saas-ui/react'
import { useNavigate } from '@tanstack/react-router'

import { LogoIcon } from '@workspace/ui/logo'

import { api } from '#lib/trpc/react'

export function AcceptInvitePage({ params }: { params: { token: string } }) {
  const navigate = useNavigate()

  const { data, isLoading, error } = api.workspaceMembers.invitation.useQuery({
    token: params.token,
  })

  const mutation = api.workspaceMembers.acceptInvitation.useMutation({
    onSuccess() {
      if (!data?.workspace.slug) {
        return
      }

      toast.success({
        title: 'Invitation accepted',
        description: 'You have successfully joined the workspace.',
      })

      navigate({
        to: '/$workspace',
        params: {
          workspace: data.workspace.slug,
        },
      })
    },
    onError(error) {
      console.error(error)
      toast.error({
        title: 'Failed to accept invitation',
        description: error.message,
      })
    },
  })

  if (isLoading) {
    return (
      <LoadingOverlay.Root>
        <LoadingOverlay.Spinner />
      </LoadingOverlay.Root>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Token invalid or expired"
        description="Please ask the person who invited you to send a new invitation."
      />
    )
  }

  return (
    <Stack flex="1" direction="row">
      <Stack
        flex="1"
        alignItems="flex-start"
        justify="center"
        direction="column"
        gap="8"
      >
        <Container>
          <LogoIcon boxSize="10" mb="8" />

          <Heading as="h2" size="lg" mb="6">
            {data?.invitedBy ? (
              <>
                {data.invitedBy} invited you to join the {data?.workspace.name}{' '}
                workspace
              </>
            ) : (
              <>
                You have been invited to join the {data?.workspace.name}{' '}
                workspace
              </>
            )}
          </Heading>

          <Button
            colorScheme="primary"
            size="md"
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate({
                token: params.token,
              })
            }}
          >
            Accept invitation
          </Button>
        </Container>
      </Stack>
    </Stack>
  )
}
