/**
 * Acknowledgement: This file is inspired by @sst/console.
 * @url https://github.com/sst/console/blob/dev/packages/core/src/util/sql.ts
 */
import { createId } from '@paralleldrive/cuid2'
import { timestamp, varchar } from 'drizzle-orm/pg-core'

export * from 'drizzle-orm/pg-core'

export { pgTable } from './_table'

export { createId }

export const cuid = (name: string) => varchar(name, { length: 24 })

export const id = {
  get id() {
    return cuid('id')
      .primaryKey()
      .notNull()
      .$defaultFn(() => createId())
  },
}

export const workspaceId = {
  get id() {
    return cuid('id')
      .notNull()
      .$defaultFn(() => createId())
  },
  get workspaceId() {
    return cuid('workspace_id').notNull()
  },
}

export const userId = (name = 'user_id') => varchar(name, { length: 36 }) // cuid or uuid

export const timestamps = {
  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .$onUpdate(() => new Date()),
}
