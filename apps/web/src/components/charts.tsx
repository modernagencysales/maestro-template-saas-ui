import {
  Area,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AreaChart({
  data,
  categories,
  valueFormatter,
  yAxisWidth = 40,
  height = "300px",
  ..._compatibilityProps
}: {
  data: readonly Record<string, string | number>[];
  categories: readonly string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  height?: string;
  strokeWidth?: string | number;
  variant?: string;
  showLegend?: boolean;
}) {
  const category = categories[0] ?? "";
  return (
    <ResponsiveContainer width="100%" height={Number.parseInt(height, 10)}>
      <RechartsAreaChart data={[...data]}>
        <XAxis dataKey="date" />
        <YAxis width={yAxisWidth} />
        <Tooltip formatter={(value) => valueFormatter?.(Number(value)) ?? value} />
        <Area type="monotone" dataKey={category} fill="var(--chakra-colors-color-palette-solid)" stroke="var(--chakra-colors-color-palette-solid)" />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
