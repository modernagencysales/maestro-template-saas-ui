import { Box, Text } from "@saas-ui/react";

// Adapted from the pinned starter reports/metrics/revenue-chart.tsx with no demo data or chart provider.
export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

const pointsFor = (data: readonly ChartPoint[]) => {
  const maximum = Math.max(...data.map((point) => point.value), 1);
  return data
    .map(
      (point, index) =>
        `${(index / Math.max(data.length - 1, 1)) * 100},${100 - (point.value / maximum) * 100}`,
    )
    .join(" ");
};

export function AnalyticsChart({
  data,
  label,
}: {
  readonly data: readonly ChartPoint[];
  readonly label: string;
}) {
  return (
    <Box color="chart.primary">
      <Text color="fg.muted" fontSize="sm">
        {label}
      </Text>
      <svg aria-label={label} role="img" viewBox="0 0 100 100" width="100%">
        <polyline
          fill="none"
          points={pointsFor(data)}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </Box>
  );
}
