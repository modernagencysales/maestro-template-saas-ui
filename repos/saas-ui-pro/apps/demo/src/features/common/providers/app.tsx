'use client'

import * as React from 'react'

import { ChakraProvider } from '@chakra-ui/react'
import { FeaturesProvider } from '@saas-ui-pro/feature-flags'
import { useHotkey } from '@tanstack/react-hotkeys'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import NextLink from 'next/link'
import { IconContext } from 'react-icons'

import { ModalsProvider } from '#components/modals'
import { appHotkeys, segments } from '#config'
import { LinkProvider } from '#lib/use-link/use-link'
import { system } from '#theme'

import { Hotkeys } from '../components/hotkeys'
import { getQueryClient } from '../lib/react-query'
import { AuthProvider } from './auth'
import { I18nProvider } from './i18n'

/**
 * We use a custom color mode manager to sync the color mode
 * value with the cookie value. This will prevent any flash
 * of color mode mismatch when the page loads.
 */
// type StorageManager = typeof localStorageManager
// const colorModeManager: StorageManager = {
//   type: 'cookie',
//   ssr: true,
//   get: (initialColorMode?: ColorMode): ColorMode | undefined => {
//     const storedColorMode = getCookie('chakra-ui-color-mode') as
//       | ColorMode
//       | undefined

//     return storedColorMode ? storedColorMode : initialColorMode
//   },
//   set: (value: string) => {
//     setCookie('chakra-ui-color-mode', value, {
//       maxAge: 31536000,
//       path: '/',
//     })
//   },
// }

export interface AppProviderProps {
  onError?: (error: Error, info: any) => void
  initialColorMode?: any
  children: React.ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = (props) => {
  const { onError, children } = props

  const [showDevtools, setShowDevtools] = React.useState(false)

  /**
   * Toggle React Query devtools
   */
  useHotkey('Control+Shift+D', () => {
    setShowDevtools((prev) => !prev)
  })

  const queryClient = React.useMemo(() => getQueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ className: 'react-icon', size: '1.1em' }}>
        <ChakraProvider value={system}>
          <LinkProvider component={NextLink}>
            <AuthProvider>
              <FeaturesProvider value={segments}>
                <I18nProvider>
                  <Hotkeys hotkeys={appHotkeys}>
                    <ModalsProvider>{children}</ModalsProvider>
                  </Hotkeys>
                </I18nProvider>
              </FeaturesProvider>
            </AuthProvider>
          </LinkProvider>
        </ChakraProvider>
      </IconContext.Provider>
      {showDevtools && <ReactQueryDevtools position="right" />}
    </QueryClientProvider>
  )
}
