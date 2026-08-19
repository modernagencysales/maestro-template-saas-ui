import { IntlShape } from '@formatjs/intl'
import { z } from 'zod'

import { makeZodErrorMap } from './make-zod-error-map'

export function setZodErrorMap<T>(intl: IntlShape<T>) {
  z.setErrorMap((issue) => makeZodErrorMap(issue, intl))
}
