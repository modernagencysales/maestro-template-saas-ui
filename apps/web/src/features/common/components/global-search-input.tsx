import * as React from 'react'

import { mergeRefs } from '@chakra-ui/react'
import { Command } from '@saas-ui/react/command'
import { useHotkeysShortcut } from '@saas-ui/use-hotkeys'

import { SearchInput, type SearchInputProps } from '@workspace/ui/search-input'

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
