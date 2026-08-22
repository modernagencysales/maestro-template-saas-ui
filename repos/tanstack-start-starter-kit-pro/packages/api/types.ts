/**
 * This file is used to export all types and enums from the API
 * and can be imported in your client code from `@workspace/api/types`.
 */
export interface Session {
  user: {
    id: string
    email?: string | null
    name?: string | null
  }
}

export type { AppRouter, RouterInputs, RouterOutputs } from './trpc'

export type {
  WorkspaceDTO,
  WorkspaceMemberDTO,
} from './modules/workspaces/workspaces.schema'

export type { WorkspaceMemberSettingsDTO } from './modules/workspace-members/workspace-members.schema'

export type { UserDTO } from './modules/users/users.schema'

export type { TagDTO } from './modules/tags/tags.schema'

export type { ContactDTO } from './modules/contacts/contacts.schema'

export type { NotificationDTO } from './modules/notifications/notifications.schema'

export { ActivityLogTypes } from './modules/activity-logs/activity-logs.types'
