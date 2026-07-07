import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export type LineageNode = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
};

export function TemplateLineagePanel({
  nodes,
  state,
}: {
  readonly nodes: readonly LineageNode[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Lineage"
      state={state}
      emptyLabel="No lineage"
      errorLabel="Could not load lineage"
    >
      <ol className="template-lineage">
        {nodes.map((node, index) => (
          <li key={node.id}>
            <Badge>{index + 1}</Badge>
            <span>{node.label}</span>
            <small>{node.detail}</small>
          </li>
        ))}
      </ol>
    </VisualShell>
  );
}
