import { Box, BoxProps } from '@chakra-ui/react'
import { useLocalStorage } from '@saas-ui/hooks'
import { Tooltip } from '@saas-ui/react'

import {
  DateTime as FormatDateTime,
  RelativeTime as FormatRelativeTime,
  useIntl,
} from '../../../i18n/src'

export interface DateTimeSinceProps extends BoxProps {
  date: Date
  format?: 'short' | 'long' | 'narrow'
}

/**
 * Display a date and time in a relative or absolute format.
 */
export const DateTimeSince: React.FC<DateTimeSinceProps> = (props) => {
  const { date, format, ...rest } = props
  const [type, setType] = useLocalStorage('date-time-type', 'relative')

  const intl = useIntl()

  return (
    <Tooltip content={`${intl.formatDate(date)}, ${intl.formatTime(date)}`}>
      <Box
        as="span"
        {...rest}
        onClick={(e) => {
          e.stopPropagation()
          setType(type === 'relative' ? 'absolute' : 'relative')
        }}
      >
        {type === 'relative' ? (
          <FormatRelativeTime date={props.date} style={format} />
        ) : (
          <FormatDateTime date={props.date} style={format} />
        )}
      </Box>
    </Tooltip>
  )
}
