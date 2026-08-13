import { StackProps, Tag } from '@chakra-ui/react'

import { StatusBadge } from '@workspace/ui/status-badge'

const contactStatus = {
  active: {
    label: 'Active',
    color: 'green',
  },
  inactive: {
    label: 'Inactive',
    color: 'orange',
  },
  new: {
    label: 'New',
    color: 'blue',
  },
} as const

export type ContactStatusEnum = keyof typeof contactStatus

export interface ContactStatusProps extends StackProps {
  status: ContactStatusEnum
  hideLabel?: boolean
}

export const ContactStatus: React.FC<ContactStatusProps> = (props) => {
  const { status, hideLabel, ...rest } = props
  const { color, label } = contactStatus[status] || contactStatus.new
  return (
    <Tag.Root
      colorPalette="gray"
      variant="outline"
      h="6"
      borderRadius="full"
      {...rest}
    >
      <StatusBadge colorPalette={color} />
      {!hideLabel && <Tag.Label>{label}</Tag.Label>}
    </Tag.Root>
  )
}
