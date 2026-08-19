import { WorkspaceModel, createInsertSchema, workspaces } from '@workspace/db'

import { BillingSubscriptionDTO } from '#modules/billing/billing.schema'
import { UserDTO } from '#modules/users/users.schema'

export const WorkspaceSchema = createInsertSchema(workspaces)

export interface WorkspaceDTO extends WorkspaceModel {
  subscription: Omit<
    BillingSubscriptionDTO,
    'workspaceId' | 'customerId' | 'quantity'
  >
  members: WorkspaceMemberDTO[]
}

export type WorkspaceMemberDTO = UserDTO & {
  roles: string[]
}

export type WorkspaceMemberStatus = 'active' | 'suspended' | 'invited'

export const CreateWorkspaceSchema = WorkspaceSchema.pick({
  id: true,
  ownerId: true,
  name: true,
  slug: true,
}).partial({
  id: true,
})

export const UpdateWorkspaceSchema = WorkspaceSchema.pick({
  id: true,
  name: true,
  slug: true,
  logo: true,
})
  .required({
    id: true,
  })
  .partial({
    slug: true,
  })
