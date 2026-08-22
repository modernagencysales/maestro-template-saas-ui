import * as React from 'react'

import { Container } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import {
  LatestMessagesCard,
  type LatestMessagesCardProps,
} from './latest-messages-card'

export default {
  title: 'Blocks/Communication/LatestMessagesCard',
  decorators: [
    (Story) => (
      <Container>
        <Story />
      </Container>
    ),
  ],
} as Meta

const messages = [
  {
    name: 'Jane Fonda',
    avatar: '/avatars/12.jpg',
    date: '2 days ago',
    message: 'Looking forward to our meeting!',
    presence: 'online',
    unread: true,
  },
  {
    name: 'Dianne Russell',
    avatar: '/avatars/11.jpg',
    date: '16 Jan 2024',
    message: 'Can you send the file?',
    presence: 'dnd',
    unread: false,
  },
  {
    name: 'Courtney Henry',
    avatar: '/avatars/10.jpg',
    date: '3 Jan 2024',
    message: 'See you at 7pm!',
    presence: 'busy',
    unread: false,
  },
] satisfies LatestMessagesCardProps['items']

export const Default = () => <LatestMessagesCard items={messages} />
