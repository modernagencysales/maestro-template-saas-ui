import * as React from 'react'

import {
  Box,
  Card,
  HStack,
  IconButton,
  Tag,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { useSearchQuery } from '@saas-ui/hooks'
import {
  Button,
  Dialog,
  EmptyState,
  GridList,
  Menu,
  type PersonaPresence,
} from '@saas-ui/react'
import { LuEllipsis } from 'react-icons/lu'
import { z } from 'zod'

import { type FieldOptions, Form, useAppForm } from '@workspace/ui/form'
import {
  InviteData,
  InviteDialog,
  defaultMemberRoles,
} from '@workspace/ui/invite-dialog'
import { useModals } from '@workspace/ui/modals'
import { SearchInput } from '@workspace/ui/search-input'

import { UserAvatar } from '#components/user-avatar'

export interface Member {
  id: string
  email: string
  name?: string
  status?: 'invited' | 'active' | 'suspended'
  roles?: string | string[]
  presence?: PersonaPresence
}

const Roles = ({ roles }: { roles?: string | string[] }) => {
  if (!roles || !roles.length) {
    return null
  }

  if (typeof roles === 'string') {
    return (
      <Tag.Root colorPalette="gray" size="sm">
        <Tag.Label>{roles}</Tag.Label>
      </Tag.Root>
    )
  }

  return (
    <>
      {roles?.map((role) => (
        <Tag.Root colorPalette="gray" key={role} size="sm">
          <Tag.Label>{role}</Tag.Label>
        </Tag.Root>
      ))}
    </>
  )
}

interface MemberListItemProps<M> {
  member: M
  onRemove(member: M): void
  onResendInvite(member: M): void
  onCancelInvite(member: M): void
  onChangeRole(member: M): void
}
function MembersListItem<M extends Member = Member>({
  member,
  onRemove,
  onResendInvite,
  onCancelInvite,
  onChangeRole,
}: MemberListItemProps<M>) {
  let actions

  const isInvite = member.status === 'invited'

  if (isInvite) {
    actions = (
      <>
        <Menu.Item value="resend" onClick={() => onResendInvite?.(member)}>
          Resend invitation
        </Menu.Item>
        <Menu.Item value="cancel" onClick={() => onCancelInvite?.(member)}>
          Cancel invitation
        </Menu.Item>
      </>
    )
  } else {
    actions = (
      <>
        <Menu.Item value="change" onClick={() => onChangeRole?.(member)}>
          Change role
        </Menu.Item>
        <Menu.Item value="remove" onClick={() => onRemove?.(member)}>
          Remove member
        </Menu.Item>
      </>
    )
  }

  return (
    <GridList.Item
      py="4"
      borderBottomWidth="1px"
      css={{ '&:last-of-type': { borderWidth: 0 } }}
    >
      <GridList.Cell>
        <UserAvatar
          user={member}
          presence={member.presence as PersonaPresence}
          size="xs"
        />
      </GridList.Cell>
      <GridList.Cell flex="1" px="4" flexDirection="column" gap="0">
        <Text textStyle="sm" fontWeight="medium">
          {member.name || member.email}
        </Text>
        <Text color="fg.muted" textStyle="sm">
          {member.name ? member.email : null}
        </Text>
      </GridList.Cell>
      <GridList.Cell>
        <HStack>
          {isInvite ? (
            <Tag.Root size="sm" variant="surface">
              {member.status}
            </Tag.Root>
          ) : (
            <Roles roles={member.roles} />
          )}
        </HStack>
      </GridList.Cell>
      <GridList.Cell>
        <Box>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton variant="ghost" size="sm">
                <LuEllipsis />
              </IconButton>
            </Menu.Trigger>
            <Menu.Content>{actions}</Menu.Content>
          </Menu.Root>
        </Box>
      </GridList.Cell>
    </GridList.Item>
  )
}

export interface MembersListProps<TMember> extends Omit<
  Card.RootProps,
  'children'
> {
  inviteLabel?: string
  searchLabel?: string
  noResults?: string
  members: Array<TMember>
  roles?: FieldOptions
  allowInvite?: boolean
  multiRoles?: boolean
  onRemove(member: TMember): void
  onInvite(data: InviteData): Promise<any>
  onCancelInvite(member: TMember): Promise<any>
  onUpdateRoles(member: TMember, roles: string[]): Promise<any>
}

export function MembersList<TMember extends Member = Member>({
  inviteLabel = 'Invite people',
  searchLabel = 'Filter by name or email',
  noResults = 'No people found',
  members,
  roles = defaultMemberRoles,
  allowInvite = true,
  multiRoles = false,
  onRemove,
  onInvite,
  onCancelInvite,
  onUpdateRoles,
  ...cardProps
}: MembersListProps<TMember>) {
  const modals = useModals()
  const invite = useDisclosure()

  const { results, ...searchProps } = useSearchQuery<TMember>({
    items: members,
    fields: ['name', 'email'],
  })

  const onChangeRole = React.useCallback(
    (member: TMember) => {
      modals.open(UpdateRolesDialog, {
        onSubmit: async (roles) => {
          onUpdateRoles?.(member, roles)
        },
        multiRoles,
      })
    },
    [modals],
  )

  return (
    <Card.Root {...cardProps}>
      <Card.Header display="flex" flexDirection="row" gap="2" px="3" pb="2">
        <SearchInput
          placeholder={searchLabel}
          size="sm"
          {...searchProps}
          onChange={(e) => searchProps.setQuery(e.target.value)}
          mr="2"
        />
        <Button
          onClick={invite.onOpen}
          disabled={!allowInvite}
          colorPalette="accent"
          variant="glass"
          flexShrink="0"
          size="sm"
        >
          {inviteLabel}
        </Button>
      </Card.Header>
      {results?.length ? (
        <GridList.Root py="0">
          {results.map((member, i) => (
            <MembersListItem<TMember>
              key={i}
              member={member}
              onRemove={onRemove}
              onResendInvite={({ email, roles }) =>
                onInvite({ emails: [email], role: roles?.[0] })
              }
              onCancelInvite={onCancelInvite}
              onChangeRole={onChangeRole}
            />
          ))}
        </GridList.Root>
      ) : (
        <EmptyState title={noResults} size="sm" p="4" />
      )}
      <InviteDialog
        title={inviteLabel}
        onInvite={onInvite}
        open={invite.open}
        onOpenChange={(details) => {
          if (details.open) {
            invite.onOpen()
          } else {
            invite.onClose()
          }
        }}
        roles={roles}
      />
    </Card.Root>
  )
}

function UpdateRolesDialog(props: {
  onSubmit: (roles: string[]) => Promise<any>
  multiRoles?: boolean
  open: boolean
  onOpenChange: (details: { open: boolean }) => void
  defaultValues?: {
    roles: string[]
  }
}) {
  const {
    open,
    onOpenChange,
    onSubmit,
    multiRoles = false,
    defaultValues,
  } = props

  const form = useAppForm({
    validators: {
      onSubmit: z.object({
        roles: z.array(z.string()),
      }),
    },
    defaultValues: {
      roles: defaultValues?.roles ?? [],
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value.roles)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Form form={form}>
          <Dialog.Header>
            <Dialog.Title>Update roles</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <form.AppField name="roles">
              {(field) => (
                <field.SelectField
                  multiple={multiRoles}
                  options={defaultMemberRoles}
                />
              )}
            </form.AppField>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.CloseTrigger>
            <form.SubmitButton>Update</form.SubmitButton>
          </Dialog.Footer>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
