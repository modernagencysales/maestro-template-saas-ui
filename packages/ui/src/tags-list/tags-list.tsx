import * as React from 'react'

import { Tag } from '@chakra-ui/react'
import { useSearchQuery } from '@saas-ui/hooks'
import {
  Box,
  type BoxProps,
  Checkbox,
  Command,
  HTMLChakraProps,
  Input,
  InputGroup,
  Menu,
  Portal,
  UseControllableStateProps,
  chakra,
  useControllableState,
  useDisclosure,
} from '@saas-ui/react'
import { PlusIcon } from 'lucide-react'

export interface TagsListProps extends HTMLChakraProps<'div'> {
  children: React.ReactNode
}

export const TagsList = React.forwardRef<HTMLDivElement, TagsListProps>(
  function TagsList(props, ref) {
    return (
      <chakra.div ref={ref} {...props}>
        {props.children}
      </chakra.div>
    )
  },
)

export interface TagsListItemProps extends Omit<Tag.RootProps, 'rightIcon'> {
  icon?: React.ReactNode
  onDelete?(): void
}

export const TagsListItem: React.FC<TagsListItemProps> = (props) => {
  const { icon, children, onDelete } = props

  let _icon
  if (icon && React.isValidElement(icon)) {
    _icon = React.cloneElement(icon, {
      verticalAlign: 'top',
      marginEnd: '0.5rem',
    } as any)
  }

  return (
    <Tag.Root
      me="1"
      mb="1"
      colorPalette="gray"
      variant="outline"
      rounded="full"
      size="md"
      px="2"
      py="1"
    >
      {_icon}
      <Tag.Label>{children}</Tag.Label>
      {onDelete && <Tag.CloseTrigger onClick={onDelete} />}
    </Tag.Root>
  )
}

export const TagColor: React.FC<BoxProps> = (props) => {
  return <Box bg="currentColor" borderRadius="full" boxSize="8px" {...props} />
}

export interface AddTagProps
  extends
    UseControllableStateProps<string[]>,
    Omit<Menu.RootProps, 'children'> {
  tags?: Array<{ id: string; label: string; color?: string }>
  onCreate?(tag: string): void
}

export const AddTag: React.FC<AddTagProps> = (props) => {
  const {
    value: valueProp,
    defaultValue,
    onChange: onChangeProp,
    onCreate: onCreateProp,
    ...menuProps
  } = props

  const [value, setValue] = useControllableState({
    defaultValue: defaultValue || [],
    value: valueProp,
    onChange: onChangeProp,
  })

  const {
    results,
    onReset,
    value: inputValue,
    ...inputProps
  } = useSearchQuery({
    items: props.tags || [],
    fields: ['label'],
  })

  const { open, onOpen, onClose } = useDisclosure({
    onClose() {
      setTimeout(() => {
        onReset()
      }, 100) // prevent flicker
    },
  })

  const onCreate = (tag: string) => {
    onCreateProp?.(tag)
    onClose()
    setValue([...value, tag])
  }

  const toggleTag = (tag: string, checked: boolean) => {
    setValue((value) => {
      const values = new Set(value)
      if (checked) {
        values.add(tag)
      } else {
        values.delete(tag)
      }
      return Array.from(values)
    })
  }

  return (
    <Menu.Root
      closeOnSelect={false}
      positioning={{ placement: 'left-start' }}
      open={open}
      onOpenChange={({ open }) => {
        if (open) {
          onOpen()
        } else {
          onClose()
        }
      }}
      {...menuProps}
    >
      <Menu.Button
        size="xs"
        variant="ghost"
        color="fg.muted"
        _hover={{
          color: 'fg',
          borderColor: 'border',
        }}
      >
        <PlusIcon size="1.2em" /> Add tag
      </Menu.Button>
      <Portal>
        <Menu.Content pt="0" zIndex="dropdown">
          <Box
            borderBottomWidth="1px"
            borderColor="border.subtle"
            mx="-2"
            mb="1"
          >
            <InputGroup endElement={<Command size="sm">L</Command>}>
              <Input
                placeholder="Add tags"
                borderWidth="0"
                onKeyUp={(e) => {
                  if (e.key === 'Enter' && !results?.length && inputValue) {
                    onCreate?.(inputValue)
                  }
                }}
                onChange={(e) => {
                  inputProps.onChange(e.target.value)
                }}
              />
            </InputGroup>
          </Box>
          <Menu.ItemGroup>
            {!inputValue || results?.length ? (
              (results || []).map(({ label, color }) => {
                const checked = value.includes(label)

                return (
                  <Menu.Item
                    key={label}
                    value={label}
                    onClick={() => {
                      toggleTag(label, !checked)
                    }}
                  >
                    <Checkbox size="sm" checked={checked} role="presentation" />
                    <TagColor color={color} /> {label}
                  </Menu.Item>
                )
              })
            ) : (
              <Menu.Item value="create" onClick={() => onCreate?.(inputValue)}>
                Create tag:{' '}
                <chakra.span color="muted" ms="1">
                  &quot;{inputValue}&quot;
                </chakra.span>
              </Menu.Item>
            )}
          </Menu.ItemGroup>
        </Menu.Content>
      </Portal>
    </Menu.Root>
  )
}
