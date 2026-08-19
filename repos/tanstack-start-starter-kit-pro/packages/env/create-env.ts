/// <reference types="./import-meta-env.d.ts" />
import { z } from 'zod'

export function createEnv<Schema extends z.ZodObject<z.ZodRawShape>>(
  schema: Schema,
  clientEnv?: Partial<z.infer<Schema>>,
): z.infer<Schema> {
  const env = {
    ...import.meta.env,
    ...process.env,
    ...clientEnv,
  }

  if (!!process.env.CI || process.env.npm_lifecycle_event === 'lint') {
    return env as any
  }

  const result = schema.safeParse(env)

  if (!result.success) {
    throw new Error(
      'Invalid environment variables:\n' +
        result.error.issues
          .map((issue) => `❗'${issue.path.join('.')}' ${issue.message}`)
          .join('\n'),
    )
  }

  return result.data
}
