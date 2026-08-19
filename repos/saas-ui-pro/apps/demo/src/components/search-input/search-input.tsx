import * as React from 'react'

import { LuSearch, LuX } from 'react-icons/lu'

import {
  SearchInput as BaseSearchInput,
  type SearchInputProps,
} from '#ui/search-input/search-input'

export type { SearchInputProps }

/**
 * SearchInput with Lucide icons.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (props, ref) => {
    return (
      <BaseSearchInput
        ref={ref}
        icon={<LuSearch />}
        resetIcon={<LuX />}
        {...props}
      />
    )
  },
)
