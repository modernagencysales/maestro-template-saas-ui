'use client'

import { LuFolderSearch } from 'react-icons/lu'

import { ErrorPage } from '#components/error-page'
import { FullscreenLayout } from '#features/common/layouts/fullscreen-layout'

export function WorkspaceNotFound() {
  return (
    <FullscreenLayout>
      <ErrorPage
        title="This workspace does not exist"
        icon={<LuFolderSearch />}
      />
    </FullscreenLayout>
  )
}
