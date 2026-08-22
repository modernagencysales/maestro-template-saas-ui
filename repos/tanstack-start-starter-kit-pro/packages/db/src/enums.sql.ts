import { pgEnum } from 'drizzle-orm/pg-core'

export const actorTypeEnum = pgEnum('actor_type', ['user', 'system'])

export const subjectTypeEnum = pgEnum('subjectType', ['contact'])

export const targetTypeEnum = pgEnum('target_type', ['user'])
