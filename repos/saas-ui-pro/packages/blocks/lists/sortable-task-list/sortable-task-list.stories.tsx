import * as React from 'react'

import type { Meta } from '@storybook/react-vite'

import { SortableTaskList, type Task } from './sortable-task-list'

const meta = {
  title: 'Blocks/Lists/SortableTaskList',
} satisfies Meta

export default meta

const tasks: Array<Task> = [
  {
    id: 'SUI-123',
    title: 'Research product trends',
    date: '10 Jan',
    labels: ['Research', 'Trends'],
    status: 'in-progress',
  },
  {
    id: 'SUI-133',
    title: 'Develop user interface',
    date: '3 Feb',
    labels: ['UI', 'Development'],
    status: 'in-progress',
  },
  {
    id: 'SUI-134',
    title: 'Create user experience flows',
    date: '5 Feb',
    labels: ['UX', 'Flows'],
    status: 'in-progress',
  },
  {
    id: 'SUI-135',
    title: 'Select materials for production',
    date: '7 Feb',
    labels: ['Materials', 'Production'],
    status: 'in-progress',
  },
  {
    id: 'SUI-136',
    title: 'Work with engineers on product specifications',
    date: '9 Feb',
    labels: ['Engineering', 'Specifications'],
    status: 'in-progress',
  },
  {
    id: 'SUI-137',
    title: 'Conduct user research',
    date: '11 Feb',
    labels: ['User research', 'Testing'],
    status: 'in-progress',
  },
  {
    id: 'SUI-124',
    title: 'Brainstorm product ideas',
    date: '12 Jan',
    labels: ['Brainstorming', 'Ideas'],
    status: 'todo',
  },
  {
    id: 'SUI-125',
    title: 'Create initial sketches',
    date: '15 Jan',
    labels: ['sketches', 'design'],
    status: 'todo',
  },
  {
    id: 'SUI-126',
    title: 'Get feedback on sketches',
    date: '17 Jan',
    labels: ['Feedback', 'Design'],
    status: 'todo',
  },
  {
    id: 'SUI-127',
    title: 'Refine and finalize design',
    date: '20 Jan',
    labels: ['Design', 'Refinement'],
    status: 'todo',
  },
  {
    id: 'SUI-128',
    title: 'Create 3D model',
    date: '23 Jan',
    labels: ['3D', 'Model'],
    status: 'todo',
  },
  {
    id: 'SUI-129',
    title: 'Test and iterate prototype',
    date: '25 Jan',
    labels: ['Testing', 'Prototype'],
    status: 'todo',
  },
  {
    id: 'SUI-130',
    title: 'Refine prototype based on feedback',
    date: '27 Jan',
    labels: ['Feedback', 'Iteration'],
    status: 'todo',
  },
  {
    id: 'SUI-131',
    title: 'Create final product',
    date: '30 Jan',
    labels: ['Final', 'Product'],
    status: 'done',
  },
  {
    id: 'SUI-132',
    title: 'Test final product before launch',
    date: '1 Feb',
    labels: ['testing', 'final'],
    status: 'done',
  },
]

export const Default = () => <SortableTaskList tasks={tasks} />
