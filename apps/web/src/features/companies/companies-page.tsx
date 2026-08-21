'use client'

import { EmptyState, Page } from '@saas-ui/react'
import { LuBuilding } from 'react-icons/lu'

import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'

export function CompaniesPage() {
  return (
    <Page.Root>
      <Page.Header title="Companies" nav={<SidebarToggleButton />} />
      <Page.Body>
        <EmptyState
          title="Companies"
          description="Manage your companies."
          icon={<LuBuilding />}
        />
      </Page.Body>
    </Page.Root>
  )
}
