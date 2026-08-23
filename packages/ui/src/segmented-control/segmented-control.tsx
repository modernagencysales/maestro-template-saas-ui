import * as React from 'react'

import {
  UseControllableStateProps,
  useBreakpointValue,
  useControllableState,
} from '@chakra-ui/react'
import { Menu, SegmentedControl as SegmentedControlBase } from '@saas-ui/react'

export type SegmentItem = { id: string; label: string }

export interface SegmentedControlProps extends UseControllableStateProps<
  string | null
> {
  segments: Array<SegmentItem>
  breakpoints?: Record<string, boolean>
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export const SegmentedControl: React.FC<SegmentedControlProps> = (props) => {
  const {
    segments,
    defaultValue: defaultValueProp,
    value: valueProp,
    onChange: onChangeProp,
    breakpoints = { base: true, md: false },
    size = 'sm',
  } = props

  const isMobile = useBreakpointValue(breakpoints, {
    fallback: 'lg',
  })

  const [value, setValue] = useControllableState({
    defaultValue: defaultValueProp,
    value: valueProp,
    onChange: onChangeProp,
  })

  const activeIndex = React.useMemo(
    () => segments.findIndex((segment) => segment.id === value),
    [segments, value],
  )
  const activeSegment = segments[activeIndex] ?? segments[0]

  if (!activeSegment) {
    return null
  }

  if (isMobile) {
    return (
      <Menu.Root>
        <Menu.Button variant="surface" size="xs">
          {activeSegment.label}
        </Menu.Button>
        <Menu.Content portalled>
          <Menu.RadioItemGroup
            value={value ?? undefined}
            onChange={(value) => setValue(value.toString())}
          >
            {segments?.map(({ id, label }) => (
              <Menu.RadioItem key={id} value={id}>
                {label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioItemGroup>
        </Menu.Content>
      </Menu.Root>
    )
  }

  return (
    <SegmentedControlBase
      value={value}
      items={segments.map(({ id, label }) => ({
        value: id,
        label,
      }))}
      onValueChange={(details) => setValue(details.value)}
      size={size}
    />
  )
}
