import { z } from 'zod'

import type { TagModel } from '@workspace/db'

export type TagDTO = Pick<TagModel, 'id' | 'name' | 'color'>

export const CreateTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().nullable(),
})

export const UpdateTagSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional().nullable(),
})

/**
 * The values of these colors can be changed in the semantic tokens config of your theme.
 * `apps/web/app/theme/semantic-tokens/colors.ts`
 */
export const tagColors = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'cyan',
  'purple',
  'pink',
]
