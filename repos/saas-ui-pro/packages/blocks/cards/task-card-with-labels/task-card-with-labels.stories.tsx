import * as React from 'react'

import { Container } from '@chakra-ui/react'
import type { Meta } from '@storybook/react-vite'

import { type Task, TaskCardWithLabels } from './task-card-with-labels'

export default {
  title: 'Blocks/Cards/TaskCardWithLabels',
  decorators: [
    (Story) => (
      <Container maxWidth="lg">
        <Story />
      </Container>
    ),
  ],
} as Meta

const task = {
  status: 'backlog',
  priority: 3,
  dueDate: '2024-03-01',
  user: {
    name: 'Sara Cruz',
    avatar: '/avatars/10.jpg',
    presence: 'online',
  },
  tags: ['css', 'ui', 'javascript', 'react'],
  milestone: 'v1.0',
  subtasks: '3/5',
} satisfies Task

export const Default = () => <TaskCardWithLabels task={task} />
