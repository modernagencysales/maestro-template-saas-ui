'server-only'

import { createIntl, createIntlCache } from '@formatjs/intl'

const cache = createIntlCache()

export async function getIntl(locale: string) {
  const messages = (await import(`../lang/${locale}.json`)).default

  return createIntl(
    {
      locale,
      messages,
    },
    cache,
  )
}
