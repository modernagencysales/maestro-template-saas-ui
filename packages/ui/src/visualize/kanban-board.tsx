import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export type KanbanColumn = {
  readonly id: string;
  readonly label: string;
  readonly cards: readonly string[];
};

export function TemplateKanbanBoard({
  columns,
  state,
}: {
  readonly columns: readonly KanbanColumn[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Kanban board"
      state={state}
      emptyLabel="No cards"
      errorLabel="Could not load board"
    >
      <div className="template-kanban-board">
        {columns.map((column) => (
          <section className="template-kanban-column" key={column.id}>
            <header>
              <h3>{column.label}</h3>
              <Badge>{column.cards.length}</Badge>
            </header>
            {column.cards.map((card) => (
              <p className="template-kanban-card" key={card}>
                {card}
              </p>
            ))}
          </section>
        ))}
      </div>
    </VisualShell>
  );
}
