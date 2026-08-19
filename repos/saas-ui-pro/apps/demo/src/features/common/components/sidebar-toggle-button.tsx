import { IconButton } from '@chakra-ui/react'
import { LuPanelLeft, LuPanelLeftOpen } from 'react-icons/lu'

import * as Sidebar from '#ui/sidebar/sidebar'
import { useSidebar } from '#ui/sidebar/sidebar.context'

export const SidebarToggleButton = () => {
  const { open, openMobile, setMode } = useSidebar()

  return (
    <Sidebar.Trigger asChild>
      <IconButton
        variant="ghost"
        size="xs"
        aria-label="Toggle sidebar"
        data-open={open || openMobile ? 'true' : undefined}
        display={{
          lg: 'none',
        }}
        _closed={{
          display: 'flex',
        }}
        onClick={() => {
          setMode('collapsible')
        }}
      >
        {open || openMobile ? <LuPanelLeftOpen /> : <LuPanelLeft />}
      </IconButton>
    </Sidebar.Trigger>
  )
}
