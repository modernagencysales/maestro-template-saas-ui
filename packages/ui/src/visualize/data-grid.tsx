import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export function TemplateDataGrid({
  columns,
  rows,
  state,
}: {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Data grid"
      state={state}
      emptyLabel="No rows"
      errorLabel="Could not load data"
    >
      <table className="template-data-grid">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.join(":") || rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>
                  {cellIndex === 1 ? <Badge>{cell}</Badge> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </VisualShell>
  );
}
