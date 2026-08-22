'use client'

import { forwardRef } from 'react'

import { Button, Menu as ChakraMenu, Flex, Portal } from '@chakra-ui/react'

import { CheckIcon, ChevronRightIcon } from '../icons'

export interface MenuContentProps extends ChakraMenu.ContentProps {
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement>
}

const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(
  function MenuContent(props, ref) {
    const { portalled = true, portalRef, ...rest } = props
    return (
      <Portal disabled={!portalled} container={portalRef}>
        <ChakraMenu.Positioner>
          <ChakraMenu.Content ref={ref} {...rest} />
        </ChakraMenu.Positioner>
      </Portal>
    )
  },
)

export interface MenuCheckboxItemProps extends ChakraMenu.CheckboxItemProps {
  startElement?: React.ReactNode
  endElement?: React.ReactNode
}

const MenuCheckboxItem = forwardRef<HTMLDivElement, MenuCheckboxItemProps>(
  function MenuCheckboxItem(props, ref) {
    const { children, startElement, endElement, ...rest } = props
    return (
      <ChakraMenu.CheckboxItem ref={ref} {...rest}>
        {startElement}
        <ChakraMenu.ItemText>{children}</ChakraMenu.ItemText>
        {endElement}
      </ChakraMenu.CheckboxItem>
    )
  },
)

const MenuItemIndicator = forwardRef<
  HTMLDivElement,
  ChakraMenu.ItemIndicatorProps
>(function MenuItemIndicator(props, ref) {
  const { children = <CheckIcon />, ...rest } = props
  return (
    <Flex alignItems="center" justifyContent="center" w="4">
      <ChakraMenu.ItemIndicator ref={ref} {...rest}>
        {children}
      </ChakraMenu.ItemIndicator>
    </Flex>
  )
})

const MenuItemGroup = forwardRef<HTMLDivElement, ChakraMenu.ItemGroupProps>(
  function MenuItemGroup(props, ref) {
    const { title, children, ...rest } = props
    return (
      <ChakraMenu.ItemGroup ref={ref} {...rest}>
        {title && (
          <ChakraMenu.ItemGroupLabel userSelect="none">
            {title}
          </ChakraMenu.ItemGroupLabel>
        )}
        {children}
      </ChakraMenu.ItemGroup>
    )
  },
)

export interface MenuTriggerItemProps extends ChakraMenu.ItemProps {
  startIcon?: React.ReactNode
}

const MenuTriggerItem = forwardRef<HTMLDivElement, MenuTriggerItemProps>(
  function MenuTriggerItem(props, ref) {
    const { startIcon, children, ...rest } = props
    return (
      <ChakraMenu.TriggerItem ref={ref} {...rest}>
        {startIcon}
        {children}
        <ChevronRightIcon />
      </ChakraMenu.TriggerItem>
    )
  },
)

const MenuButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & ChakraMenu.TriggerProps
>(function MenuButton(props, ref) {
  return (
    <ChakraMenu.Trigger ref={ref} asChild>
      <Button {...props} />
    </ChakraMenu.Trigger>
  )
})

export const Menu = {
  Root: ChakraMenu.Root,
  Content: MenuContent,
  Arrow: ChakraMenu.Arrow,
  CheckboxItem: MenuCheckboxItem,
  RadioItem: ChakraMenu.RadioItem,
  ItemIndicator: MenuItemIndicator,
  ItemGroup: MenuItemGroup,
  TriggerItem: MenuTriggerItem,
  RadioItemGroup: ChakraMenu.RadioItemGroup,
  ContextTrigger: ChakraMenu.ContextTrigger,
  Separator: ChakraMenu.Separator,
  Item: ChakraMenu.Item,
  ItemText: ChakraMenu.ItemText,
  ItemCommand: ChakraMenu.ItemCommand,
  Trigger: ChakraMenu.Trigger,
  Button: MenuButton,
  Context: ChakraMenu.Context,
}
