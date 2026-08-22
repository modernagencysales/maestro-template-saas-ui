import * as React from 'react'

import {
  Box,
  mergeRefs,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { XIcon } from 'lucide-react'

import { IconButton } from '#ui/icon-button/icon-button'

import { SearchInput, SearchInputProps } from '../search-input'

/**
 * InlineSearch input to be used in toolbars.
 */
export const InlineSearch = React.forwardRef<
  HTMLInputElement,
  SearchInputProps
>(function InlineSearch(props, ref) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isMobile = useBreakpointValue({ base: true, lg: false })

  useHotkey('Control+F', () => {
    inputRef.current?.focus()
  })

  const [value, setValue] = React.useState('')

  const { open, onOpen, onClose } = useDisclosure()

  const onClick = () => {
    if (!open) {
      onOpen()
      inputRef.current?.focus()
    }
  }

  const onReset = () => {
    setValue('')
    onClose()
  }

  const resetButton = isMobile ? (
    <IconButton
      onClick={onReset}
      size="xs"
      variant="ghost"
      aria-label="Reset search"
    >
      <XIcon />
    </IconButton>
  ) : undefined

  const styles = isMobile
    ? !open
      ? {
          width: '34px',
          '& .chakra-input__right-element': {
            display: 'none',
          },
          '& input': {
            pr: 0,
          },
        }
      : {
          width: 'full',
          maxW: '260px',
          overflow: 'hidden',
          position: 'absolute',
          right: 0,
          px: 4,
          py: 2,
          mt: -2,
          bg: 'app-background',
          zIndex: 1,
        }
    : {}

  return (
    <Box onClick={onClick}>
      <Box css={styles}>
        <SearchInput
          ref={mergeRefs(ref, inputRef)}
          size="sm"
          width={{ base: open ? 'full' : 8, lg: 60 }}
          pr={0}
          onReset={onReset}
          endElement={resetButton}
          value={value}
          {...props}
        />
      </Box>
    </Box>
  )
})
