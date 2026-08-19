import { z } from 'zod'

export const DashboardInputSchema = z.object({
  workspaceId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
})
