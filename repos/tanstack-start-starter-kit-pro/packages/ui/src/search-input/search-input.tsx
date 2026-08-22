import * as React from 'react'

import {
  SearchInput as BaseSearchInput,
  SearchInputProps,
} from '@saas-ui/react/search-input'
import { LuSearch, LuX } from 'react-icons/lu'

export type { SearchInputProps }

/**
 * SearchInput with Lucide icons.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(props, ref) {
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
