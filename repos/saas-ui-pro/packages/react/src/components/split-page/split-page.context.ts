import {
  type UseDisclosureReturn,
  createContext,
  createSlotRecipeContext,
} from '@chakra-ui/react'

export const [SplitPageProvider, useSplitPage] =
  createContext<UseDisclosureReturn>({
    strict: true,
    errorMessage: 'SplitPage context not available.',
  })

export const {
  withProvider,
  withContext,
  useStyles: useSplitPageStyles,
  useClassNames,
} = createSlotRecipeContext({
  key: 'suiSplitPage',
})
