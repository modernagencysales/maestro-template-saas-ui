import { FormatDateOptions, IntlShape } from '@formatjs/intl'
import { z } from 'zod'

import { errorMessages } from './error-messages'

type ZodIssue = z.core.$ZodRawIssue

// Docs https://zod.dev/ERROR_HANDLING?id=error-map-priority
export function makeZodErrorMap<T>(issue: ZodIssue, intl: IntlShape<T>) {
  const descriptorItem = getDescriptorItem<T>(issue, intl)

  return descriptorItem.key in errorMessages
    ? {
        message: intl.formatMessage(
          errorMessages[descriptorItem.key as keyof typeof errorMessages],
          descriptorItem.values,
        ),
      }
    : { message: intl.formatMessage(errorMessages['default']) }
}

export function getDescriptorItem<T>(
  issue: ZodIssue,
  intl: IntlShape<T>,
): {
  key: string
  values?: Record<string, string | number>
} {
  if (issue.code === 'invalid_format') {
    return {
      key: `string.invalid.${issue.format}`,
    }
  }

  if (issue.code === 'not_multiple_of') {
    return {
      key: `number.${issue.code}`,
    }
  }

  if (issue.code === 'invalid_type' && issue.expected === 'date') {
    return { key: 'date.invalid_date' }
  }

  if (
    issue.code === 'too_small' &&
    issue.origin === 'string' &&
    issue.minimum === 1
  ) {
    return { key: 'string.required' }
  }

  if (issue.code === 'too_small' || issue.code === 'too_big') {
    let value =
      issue.code === 'too_small'
        ? issue.minimum
        : issue.code === 'too_big'
          ? issue.maximum
          : '-'

    /**
     * The intl.formatMessage function does not support bigint values to be passed as values. That's why we have to
     * handle these values and format them already here.
     */
    if (typeof value === 'bigint') {
      value = intl.formatNumber(value)
    }

    if (issue.origin === 'date') {
      const date = new Date(value)

      if (isNaN(date.getTime())) {
        value = '-'
      } else {
        const dateOptions: FormatDateOptions = {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }

        const timeOptions: FormatDateOptions | null =
          date.getHours() === 0 && date.getMinutes() === 0
            ? null
            : {
                hour: '2-digit',
                minute: '2-digit',
              }

        value = intl.formatDate(value, {
          ...dateOptions,
          ...timeOptions,
        })
      }
    }

    return {
      key: issue.exact
        ? `${issue.origin}.exact`
        : `${issue.origin}.${issue.code}.${
            issue.inclusive ? 'inclusive' : 'exclusive'
          }`,
      values: {
        value,
      },
    }
  }

  return { key: 'default' }
}
