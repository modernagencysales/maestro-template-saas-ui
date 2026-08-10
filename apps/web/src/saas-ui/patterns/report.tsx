import type { ReactNode } from "react";
import { Card, Grid, Heading, Page, Text } from "@saas-ui/react";

// Adapted from the pinned starter reports/reports-page.tsx and metrics cards.
export interface ReportMetric {
  readonly label: string;
  readonly value: number;
  readonly format: "number" | "percent";
}

export function Report({
  children,
  locale,
  metrics,
  title,
}: {
  readonly children?: ReactNode;
  readonly locale?: string;
  readonly metrics: readonly ReportMetric[];
  readonly title: string;
}) {
  return (
    <Page.Root>
      <Page.Header title={title} />
      <Page.Body>
        <Grid
          gap="4"
          templateColumns={{
            base: "minmax(0, 1fr)",
            sm: "repeat(auto-fit, minmax(12rem, 1fr))",
          }}
        >
          {metrics.map((metric) => {
            const formatter = new Intl.NumberFormat(
              locale,
              metric.format === "percent" ? { style: "percent" } : undefined,
            );
            return (
              <Card.Root key={metric.label}>
                <Card.Body>
                  <Text color="fg.muted" fontSize="sm">
                    {metric.label}
                  </Text>
                  <Heading size="2xl" textStyle="metric">
                    {formatter.format(metric.value)}
                  </Heading>
                </Card.Body>
              </Card.Root>
            );
          })}
        </Grid>
        {children}
      </Page.Body>
    </Page.Root>
  );
}
