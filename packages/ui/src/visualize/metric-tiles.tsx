import { Badge } from "../primitives";
import { VisualShell, type VisualState, type VisualTone } from "./shared";

export type MetricTile = {
  readonly label: string;
  readonly value: string;
  readonly tone: VisualTone;
};

export function TemplateMetricTiles({
  metrics,
  state,
}: {
  readonly metrics: readonly MetricTile[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Metrics"
      state={state}
      emptyLabel="No metrics"
      errorLabel="Could not load metrics"
    >
      <div className="template-metric-tiles">
        {metrics.map((metric) => (
          <article
            className={`template-metric-tile ${metric.tone}`}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <Badge>{metric.tone}</Badge>
          </article>
        ))}
      </div>
    </VisualShell>
  );
}
