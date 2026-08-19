import { db, eq } from '@workspace/db'
import { accounts } from '@workspace/db/auth'

import { AuthAccountsDTO } from './auth.schema.ts'

export const accountById = async (id: AuthAccountsDTO['id']) => {
  const account = await db
    .select({
      id: accounts.id,
      providerId: accounts.providerId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, id))
    .limit(1)

  if (!account) {
    return null
  }

  return account.at(0)
}

export const listAccounts = async (userId: string) => {
  return await db
    .select({
      id: accounts.id,
      providerId: accounts.providerId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
}
