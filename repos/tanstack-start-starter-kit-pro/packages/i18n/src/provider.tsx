'use client'

import * as React from 'react'

import { IntlProvider, type MessageFormatElement, useIntl } from 'react-intl'

import { setZodErrorMap } from './zod'

export interface I18nProviderProps {
  locale: string
  messages: Record<string, string> | Record<string, MessageFormatElement[]>
  children: React.ReactNode
}

export const I18nProvider: React.FC<I18nProviderProps> = (props) => {
  return (
    <IntlProvider
      locale={props.locale}
      messages={props.messages}
      onError={(err) => {
        if (err.code === 'MISSING_TRANSLATION') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Missing translation', err.message)
          }
          return
        }
        throw err
      }}
    >
      <ZodIntl />
      {props.children}
    </IntlProvider>
  )
}

export function ZodIntl() {
  const intl = useIntl()

  setZodErrorMap(intl)

  return null
}
