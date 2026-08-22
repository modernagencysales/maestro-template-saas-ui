import * as React from 'react'

import type { MessageFormatElement } from 'react-intl'

import { I18nProvider as I18nProviderClient } from './provider'
import { getIntl } from './server'
import { setZodErrorMap } from './zod'

export interface I18nProviderProps {
  locale?: string
  children: React.ReactNode
}

export async function I18nProvider(props: I18nProviderProps) {
  const { locale = 'en', children } = props

  let messages:
    | Record<string, string>
    | Record<string, MessageFormatElement[]> = {}

  try {
    const intl = await getIntl(locale ?? 'en')

    setZodErrorMap(intl)

    messages = intl.messages
  } catch (error) {
    console.error('Error importing messages', error)
  }

  return (
    <I18nProviderClient locale={locale} messages={messages}>
      {children}
    </I18nProviderClient>
  )
}
