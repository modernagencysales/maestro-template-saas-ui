import { Meta, StoryObj } from '@storybook/react'
import { IntlProvider } from 'react-intl'

import { DateTimeSince, DateTimeSinceProps } from './'

export default {
  title: 'Components/DateTimeSince',
  component: DateTimeSince,
  decorators: [
    (Story) => (
      <IntlProvider locale="en">
        <Story />
      </IntlProvider>
    ),
  ],
} as Meta

type Story = StoryObj<DateTimeSinceProps>

const date = new Date()
date.setMinutes(new Date().getMinutes() - 5)

export const Default: Story = {
  args: {
    date,
  },
}
