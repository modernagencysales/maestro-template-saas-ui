'use client'

import { LuWorkflow } from 'react-icons/lu'

import * as Page from '#ui/page/page'
import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'
import { EmptyState } from '#ui/empty-state/empty-state'

export function WorkflowsPage() {
  return (
    <Page.Root>
      <Page.Header title="Workflows" nav={<SidebarToggleButton />} />
      <Page.Body>
        <EmptyState
          title="Workflows"
          description="Automate your business processes."
          icon={<LuWorkflow />}
        />
      </Page.Body>
    </Page.Root>
  )
}
