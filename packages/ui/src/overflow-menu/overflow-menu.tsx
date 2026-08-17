import { IconButton } from '@chakra-ui/react'
import { Menu } from '@saas-ui/react'
import { LuEllipsis } from 'react-icons/lu'

interface OverflowMenuRootProps extends Menu.RootProps {
  children: React.ReactNode
  label?: string
  portalled?: boolean
}

const OverflowMenuRoot: React.FC<OverflowMenuRootProps> = (props) => {
  const { children, portalled = true, label, ...rest } = props
  return (
    <Menu.Root {...rest}>
      <Menu.Trigger asChild>
        <IconButton aria-label={label} size="xs" variant="ghost">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>

      <Menu.Content portalled={portalled}>{children}</Menu.Content>
    </Menu.Root>
  )
}

const OverflowMenuItem = Menu.Item
const OverflowMenuItemGroup = Menu.ItemGroup
const OverflowMenuSeparator = Menu.Separator

export {
  OverflowMenuRoot as Root,
  OverflowMenuItem as Item,
  OverflowMenuItemGroup as ItemGroup,
  OverflowMenuSeparator as Separator,
}
