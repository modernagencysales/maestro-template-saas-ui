import { Chart, useChart } from "@chakra-ui/charts";
import { Box, Text } from "@saas-ui/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Adapted from tanstack-start-starter-kit-pro@b76cb451 reports-page.tsx.

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export function AnalyticsChart({
  data,
  label,
}: {
  readonly data: readonly ChartPoint[];
  readonly label: string;
}) {
  const chart = useChart({
    data: [...data],
    series: [{ name: "value", color: "accent.solid" }],
  });
  return (
    <Box aria-label={label} role="img">
      <Text color="fg.muted" fontSize="sm">
        {label}
      </Text>
      <Chart.Root chart={chart} height="15rem">
        <LineChart data={chart.data} accessibilityLayer>
          <CartesianGrid
            stroke={chart.color("border.subtle")}
            vertical={false}
          />
          <XAxis dataKey={chart.key("label")} tickLine={false} />
          <YAxis tickLine={false} />
          <Tooltip content={<Chart.Tooltip />} />
          <Line
            dataKey={chart.key("value")}
            dot={false}
            isAnimationActive={false}
            stroke={chart.color("accent.solid")}
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </Chart.Root>
    </Box>
  );
}
