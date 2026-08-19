'use client'

import { LuBuilding } from 'react-icons/lu'

import * as Page from '#ui/page/page'
import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'
import { EmptyState } from '#ui/empty-state/empty-state'

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
