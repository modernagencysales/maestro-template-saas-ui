'use client'

import { HotkeysProvider } from '@tanstack/react-hotkeys'

import { appHotkeys } from '#config'

import { type HotkeysConfig, HotkeysConfigProvider } from '../lib/hotkeys'

interface HotkeysProps {
  hotkeys?: HotkeysConfig
  children: React.ReactNode
}

export const Hotkeys: React.FC<HotkeysProps> = ({ children, hotkeys }) => {
  return (
    <HotkeysProvider>
      <HotkeysConfigProvider hotkeys={hotkeys || appHotkeys}>
        {children}
      </HotkeysConfigProvider>
    </HotkeysProvider>
  )
}
