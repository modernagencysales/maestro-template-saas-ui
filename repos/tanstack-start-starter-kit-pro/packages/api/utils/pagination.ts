import { z } from 'zod'

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type PaginationArgs = z.infer<typeof PaginationSchema>

export const getPaginationArgs = (args: PaginationArgs) => {
  return {
    limit: args.limit,
    offset: (args.page - 1) * args.limit,
  }
}
