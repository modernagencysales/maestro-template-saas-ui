import { type ContactModel, NotificationModel } from '@workspace/db'

export { NotificationInsertSchema } from '@workspace/db'

export type NotificationMetaData = Record<string, string | number>

export interface NotificationDTO extends Omit<NotificationModel, 'metadata'> {
  metadata: NotificationMetaData | null
  subject?: ContactModel
}

export enum NotificationTypes {
  ACTION = 'action',
  COMMENT = 'comment',
  MENTIONED = 'mentioned',
  FIELD_UPDATED = 'field-updated',
  TAGS_UPDATED = 'tags-updated',
  STATUS_UPDATED = 'status-updated',
}
