import * as React from 'react'

import type { Meta } from '@storybook/react-vite'
import { FaFileImage, FaFilePdf, FaFileWord } from 'react-icons/fa6'

import { type FileCardProps, FileCards } from './file-cards'

export default {
  title: 'Blocks/Files/FileCards',
} as Meta

const files: FileCardProps[] = [
  {
    name: 'manual.pdf',
    type: 'document',
    icon: <FaFilePdf />,
    color: 'red.500',
    size: '17KB',
    modifiedAt: '1 Sep 2023',
  },
  {
    name: 'proposal.docx',
    type: 'document',
    icon: <FaFileWord />,
    color: 'blue.500',
    size: '200KB',
    modifiedAt: '8 Nov 2023',
  },
  {
    name: 'holiday.jpg',
    type: 'image',
    previewUrl: '/img/mountains.jpg',
    icon: <FaFileImage />,
    size: '2.8MB',
    modifiedAt: '8 Aug 2023',
  },
]

export const Default = () => <FileCards files={files} />
