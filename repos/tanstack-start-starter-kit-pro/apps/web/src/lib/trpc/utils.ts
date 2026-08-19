import { TRPCClientError } from '@trpc/client'

import type { AppRouter } from '@workspace/api'

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError
}
