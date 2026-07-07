import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export type FunnelStage = {
  readonly label: string;
  readonly value: number;
};

export function TemplateFunnelView({
  stages,
  state,
}: {
  readonly stages: readonly FunnelStage[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Funnel"
      state={state}
      emptyLabel="No funnel stages"
      errorLabel="Could not load funnel"
    >
      <ol className="template-funnel">
        {stages.map((stage) => (
          <li key={stage.label}>
            <span>{stage.label}</span>
            <Badge>{stage.value}</Badge>
          </li>
        ))}
      </ol>
    </VisualShell>
  );
}
