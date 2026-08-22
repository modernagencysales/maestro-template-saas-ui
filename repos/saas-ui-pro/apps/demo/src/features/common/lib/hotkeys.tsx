'use client'

import * as React from 'react'

import {
  type HotkeySequence,
  type RegisterableHotkey,
  type UseHotkeyOptions,
  formatForDisplay,
  useHotkeySequences,
  useHotkeys,
} from '@tanstack/react-hotkeys'

/**
 * A single hotkey binding: either one hotkey (e.g. 'Mod+K', 'Escape', or a
 * `RawHotkey` object like `{ key: '?' }`) or a sequence of hotkeys for
 * vim-style shortcuts (e.g. ['G', 'U']).
 */
export type HotkeyBinding = RegisterableHotkey | HotkeySequence

export interface HotkeysItemConfig {
  /**
   * Label describing the function of this keyboard shortcut.
   */
  label: string
  /**
   * The hotkey binding.
   * @see https://tanstack.com/hotkeys for the supported hotkey syntax.
   */
  hotkey: HotkeyBinding
}

export interface HotkeysGroupConfig {
  /**
   * The group title.
   */
  title?: string
  /**
   * Hotkeys in this group.
   */
  hotkeys: Record<string, HotkeysItemConfig>
}

/**
 * The hotkeys configuration, grouped by category.
 */
export interface HotkeysConfig {
  [group: string]: HotkeysGroupConfig
}

const HotkeysConfigContext = React.createContext<HotkeysConfig>({})

export interface HotkeysConfigProviderProps {
  hotkeys: HotkeysConfig
  children: React.ReactNode
}

/**
 * Provides the app hotkeys configuration so named shortcuts can be resolved
 * with `useHotkeysShortcut`.
 */
export const HotkeysConfigProvider = (props: HotkeysConfigProviderProps) => {
  const { hotkeys, children } = props
  return (
    <HotkeysConfigContext.Provider value={hotkeys}>
      {children}
    </HotkeysConfigContext.Provider>
  )
}

export const useHotkeysConfig = () => React.useContext(HotkeysConfigContext)

const isSequence = (hotkey: HotkeyBinding): hotkey is HotkeySequence =>
  Array.isArray(hotkey)

const resolveShortcut = (
  config: HotkeysConfig,
  keyOrShortcut: string,
): HotkeyBinding | undefined => {
  const [group, key] = keyOrShortcut.split('.')

  if (group && key) {
    return config[group]?.hotkeys[key]?.hotkey
  }

  return undefined
}

/**
 * Format a hotkey binding for display, e.g. 'Mod+K' → '⌘K', ['G', 'U'] → 'G then U'.
 */
export const formatHotkey = (hotkey: HotkeyBinding): string => {
  if (isSequence(hotkey)) {
    return hotkey.map((key) => formatForDisplay(key)).join(' then ')
  }
  return formatForDisplay(hotkey)
}

/**
 * useHotkeysShortcut React Hook
 *
 * Accepts either a named shortcut from the hotkeys configuration
 * (e.g. `general.search`) or a raw hotkey binding, registers the hotkey and
 * returns the formatted key combination for display.
 *
 * @param keyOrShortcut A named shortcut (`group.key`) or a raw hotkey binding
 * @param callback The function to execute when the keys are pressed
 * @param options Options for the hotkey behavior
 * @returns The formatted key combination
 */
export const useHotkeysShortcut = (
  keyOrShortcut: string | HotkeyBinding,
  callback: (event: KeyboardEvent) => void,
  options?: UseHotkeyOptions,
): string => {
  const config = useHotkeysConfig()

  const hotkey: HotkeyBinding =
    typeof keyOrShortcut === 'string'
      ? (resolveShortcut(config, keyOrShortcut) ??
        (keyOrShortcut as RegisterableHotkey))
      : keyOrShortcut

  const sequence = isSequence(hotkey) ? hotkey : null
  const single = sequence ? null : (hotkey as RegisterableHotkey)

  // Register single hotkeys and sequences via the array-based hooks so we
  // never call a hook conditionally (empty arrays are a no-op).
  useHotkeys(single ? [{ hotkey: single, callback }] : [], options)
  useHotkeySequences(sequence ? [{ sequence, callback }] : [], options)

  return formatHotkey(hotkey)
}
