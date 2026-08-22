import { defineMessages } from '@formatjs/intl'

export const errorMessages = defineMessages({
  default: {
    id: 'validation/default',
    defaultMessage: 'Invalid input',
  },

  'number.exact': {
    id: 'validation/number.exact',
    defaultMessage: 'Must be exactly {value}',
  },
  'number.too_small.inclusive': {
    id: 'validation/number.too_small.inclusive',
    defaultMessage: 'Must be at least {value}',
  },
  'number.too_small.exclusive': {
    id: 'validation/number.too_small.exclusive',
    defaultMessage: 'Must be greater than {value}',
  },
  'number.too_big.inclusive': {
    id: 'validation/number.too_big.inclusive',
    defaultMessage: 'Must be at most {value}',
  },
  'number.too_big.exclusive': {
    id: 'validation/number.too_big.exclusive',
    defaultMessage: 'Must be less than {value}',
  },
  'number.not_multiple_of': {
    id: 'validation/number.not_multiple_of',
    defaultMessage: 'Must be a multiple of {value}',
  },

  'string.required': {
    id: 'validation/string.required',
    defaultMessage: 'Required',
  },
  'string.exact': {
    id: 'validation/string.exact',
    defaultMessage: 'Must contain exactly {value} characters',
  },
  'string.too_small.inclusive': {
    id: 'validation/string.too_small.inclusive',
    defaultMessage:
      'Must contain at least {value, plural, =1 {one character} other {# characters}}',
  },
  'string.too_small.exclusive': {
    id: 'validation/string.too_small.exclusive',
    defaultMessage:
      'Must contain over {value, plural, =1 {one character} other {# characters}}',
  },
  'string.too_big.inclusive': {
    id: 'validation/string.too_big.inclusive',
    defaultMessage:
      'Must contain at most {value, plural, =1 {one character} other {# characters}}',
  },
  'string.too_big.exclusive': {
    id: 'validation/string.too_big.exclusive',
    defaultMessage:
      'Must contain under {value, plural, =1 {one character} other {# characters}}',
  },
  'string.invalid.email': {
    id: 'validation/string.invalid.email',
    defaultMessage: 'Invalid email',
  },
  'string.invalid.url': {
    id: 'validation/string.invalid.url',
    defaultMessage: 'Invalid URL',
  },
  'string.invalid.regex': {
    id: 'validation/string.invalid.regex',
    defaultMessage: 'Invalid format',
  },
  'string.invalid.datetime': {
    id: 'validation/string.invalid.datetime',
    defaultMessage: 'Invalid date',
  },
  'string.invalid.startsWith': {
    id: 'validation/string.invalid.startsWith',
    defaultMessage: 'Must start with {value}',
  },
  'string.invalid.endsWith': {
    id: 'validation/string.invalid.endsWith',
    defaultMessage: 'Must end with {value}',
  },

  'array.exact': {
    id: 'validation/array.exact',
    defaultMessage: 'Must contain exactly {value} items',
  },
  'array.too_small.inclusive': {
    id: 'validation/array.too_small.inclusive',
    defaultMessage:
      'Must contain at least {value, plural, =1 {one item} other {# items}}',
  },
  'array.too_small.exclusive': {
    id: 'validation/array.too_small.exclusive',
    defaultMessage:
      'Must contain over {value, plural, =1 {one item} other {# items}}',
  },
  'array.too_big.inclusive': {
    id: 'validation/array.too_big.inclusive',
    defaultMessage:
      'Must contain at most {value, plural, =1 {one item} other {# items}}',
  },
  'array.too_big.exclusive': {
    id: 'validation/array.too_big.exclusive',
    defaultMessage:
      'Must contain under {value, plural, =1 {one item} other {# items}}',
  },

  'date.exact': {
    id: 'validation/date.exact',
    defaultMessage: 'Must be exactly {value}',
  },
  'date.too_small.inclusive': {
    id: 'validation/date.too_small.inclusive',
    defaultMessage: 'Must be at least {value}',
  },
  'date.too_small.exclusive': {
    id: 'validation/date.too_small.exclusive',
    defaultMessage: 'Must be after {value}',
  },
  'date.too_big.inclusive': {
    id: 'validation/date.too_big.inclusive',
    defaultMessage: 'Must be at most {value}',
  },
  'date.too_big.exclusive': {
    id: 'validation/date.too_big.exclusive',
    defaultMessage: 'Must be before {value}',
  },
  'date.invalid_date': {
    id: 'validation/date.invalid_date',
    defaultMessage: 'Invalid date',
  },
})
