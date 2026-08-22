import { createTRPCRouter, workspaceProcedure } from '#trpc'

import { DashboardInputSchema } from './dashboard.schema'
import { getDashboard } from './dashboard.service'

export const dashboardRouter = createTRPCRouter({
  get: workspaceProcedure
    .input(DashboardInputSchema)
    .query(async ({ input }) => {
      return getDashboard(input)
    }),
})
