import * as React from 'react'

import { Chart, useChart } from '@chakra-ui/charts'
import { format } from 'date-fns'
import { useIntl } from 'react-intl'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

export interface MetricData {
  timestamp: number
  value: number
}

export const RevenueChart = ({ data = [] }: { data: MetricData[] }) => {
  const intl = useIntl()

  const parsedData = React.useMemo(
    () =>
      data?.map(({ timestamp, value }) => {
        return {
          date: format(timestamp, 'd/L'),
          Revenue: value,
        }
      }),
    [data],
  )

  const chart = useChart({
    data: parsedData,
    series: [{ name: 'Revenue', color: 'indigo.solid' }],
  })

  return (
    <Chart.Root chart={chart} height="300px">
      <AreaChart data={chart.data}>
        <CartesianGrid stroke={chart.color('border.subtle')} vertical={false} />
        <XAxis axisLine={false} tickLine={false} dataKey={chart.key('date')} />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={60}
          tickFormatter={(value: number) =>
            intl.formatNumber(value, {
              currency: 'EUR',
              style: 'currency',
              maximumFractionDigits: 0,
            })
          }
        />
        <Area
          isAnimationActive={false}
          dataKey={chart.key('Revenue')}
          stroke={chart.color('indigo.solid')}
          fill={chart.color('indigo.subtle')}
          strokeWidth={2}
        />
      </AreaChart>
    </Chart.Root>
  )
}
