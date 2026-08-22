import { ActivityLogInsertSchema } from '@workspace/db'

export const ActivityLogCreateSchema = ActivityLogInsertSchema.partial({
  id: true,
})
