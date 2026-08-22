import * as React from 'react'

import type { Meta } from '@storybook/react-vite'

import { StoryCanvas } from '../../story-canvas.tsx'
import { type Chat, ChatDetails } from './chat-details'
import config from './component.config'

export default {
  title: 'Blocks/Communication/ChatDetails',
  component: ChatDetails,
  decorators: [
    (Story) => (
      <StoryCanvas {...config.canvas}>
        <Story />
      </StoryCanvas>
    ),
  ],
} as Meta

const currentUser = {
  id: '1',
  name: 'Beatriz Moreno',
}

const chat = {
  contact: {
    name: 'Katarzyna Azulay',
    email: 'katzyna@web.name',
    avatar: 'https://xsgames.co/randomusers/assets/avatars/female/25.jpg',
  },
  items: [
    {
      id: '1',
      type: 'inbound-message',
      message: "Hi, I'm having trouble with logging in. Can you help?",
      date: '2024-01-27T01:00:00.000Z',
      from: {
        id: '1',
        type: 'user',
        name: 'Katarzyna Azulay',
        avatar: 'https://xsgames.co/randomusers/assets/avatars/female/25.jpg',
      },
    },
    {
      id: '2',
      type: 'outbound-message',
      message:
        "Of course! I'd be happy to assist. Can you provide more details about the issue you're facing?",
      date: '2024-01-27T01:05:00.000Z',
      from: {
        id: '1',
        type: 'admin',
        name: 'Beatriz Moreno',
      },
    },
    {
      type: 'divider',
      date: '2024-01-29T12:00:00.000Z',
    },
    {
      id: '3',
      type: 'inbound-message',
      message: 'Sure, it says my password is incorrect.',
      date: '2024-01-29T12:00:00.000Z',
      from: {
        id: '1',
        type: 'user',
        name: 'Katarzyna Azulay',
        avatar: 'https://xsgames.co/randomusers/assets/avatars/female/25.jpg',
      },
    },
    {
      id: '4',
      type: 'outbound-message',
      message:
        "Thanks for sharing. Let me investigate this for you. I'll get back to you shortly.",
      date: '2024-01-29T12:05:00.000Z',
      from: {
        id: '1',
        type: 'admin',
        name: 'Beatriz Moreno',
      },
    },
  ],
} satisfies Chat

export const Default = () => (
  <ChatDetails chat={chat} currentUser={currentUser} />
)
