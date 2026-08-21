'use client'

import { EmptyState, Page } from '@saas-ui/react'
import { LuWorkflow } from 'react-icons/lu'

import { SidebarToggleButton } from '#features/common/components/sidebar-toggle-button.tsx'

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
