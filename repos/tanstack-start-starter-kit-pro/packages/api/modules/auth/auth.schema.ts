import { z } from 'zod'

import { createSelectSchema } from '@workspace/db'
import { accounts } from '@workspace/db/auth'

export const AuthAccounts = createSelectSchema(accounts)

export type AuthAccountsDTO = z.infer<typeof AuthAccounts>
