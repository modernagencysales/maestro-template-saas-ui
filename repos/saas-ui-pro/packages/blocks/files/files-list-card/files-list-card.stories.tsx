import * as React from 'react'

import type { Meta } from '@storybook/react-vite'

import { FilesList, type FilesListProps } from './files-list-card'

export default {
  title: 'Blocks/Files/FilesListCard',
} as Meta

const files: FilesListProps[] = [
  {
    name: 'manual.pdf',
    type: 'document',
    color: 'red.500',
    size: '17KB',
    modifiedAt: '1 Sep 2023',
  },
  {
    name: 'proposal.docx',
    type: 'document',
    color: 'blue.500',
    size: '200KB',
    modifiedAt: '8 Nov 2023',
  },
  {
    name: 'holiday.jpg',
    type: 'image',
    previewUrl: '/img/mountains.jpg',
    size: '2.8MB',
    modifiedAt: '8 Aug 2023',
  },
  {
    name: 'slidedeck.ppt',
    type: 'presentation',
    color: 'yellow.500',
    size: '300KB',
    modifiedAt: '1 Sep 2023',
  },
]

export const Default = () => <FilesList files={files} />
