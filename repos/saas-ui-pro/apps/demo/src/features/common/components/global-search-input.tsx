import * as React from 'react'

import { mergeRefs } from '@chakra-ui/react'

import { SearchInput, type SearchInputProps } from '#components/search-input'
import { useHotkeysShortcut } from '#features/common/lib/hotkeys'
import { Command } from '#ui/command/command'

export interface GlobalSearchInputProps extends SearchInputProps {}

export const GlobalSearchInput = React.forwardRef<
  HTMLInputElement,
  GlobalSearchInputProps
>(function GlobalSearchInput(props, ref) {
  const searchRef = React.useRef<HTMLInputElement>(null)

  const searchCommand = useHotkeysShortcut('general.search', () => {
    searchRef.current?.focus()
  })

  return (
    <SearchInput
      ref={mergeRefs(ref, searchRef)}
      size="sm"
      variant="subtle"
      endElement={<Command colorPalette="gray">{searchCommand}</Command>}
      {...props}
    />
  )
})
