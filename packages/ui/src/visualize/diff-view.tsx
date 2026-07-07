import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export type DiffChange = {
  readonly id: string;
  readonly kind: "added" | "removed" | "changed";
  readonly before: string;
  readonly after: string;
};

export function TemplateDiffView({
  changes,
  state,
}: {
  readonly changes: readonly DiffChange[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Diff"
      state={state}
      emptyLabel="No changes"
      errorLabel="Could not load diff"
    >
      <div className="template-diff-view">
        {changes.map((change) => (
          <article className="template-diff-row" key={change.id}>
            <Badge>{change.kind}</Badge>
            <p>{change.before}</p>
            <p>{change.after}</p>
          </article>
        ))}
      </div>
    </VisualShell>
  );
}
