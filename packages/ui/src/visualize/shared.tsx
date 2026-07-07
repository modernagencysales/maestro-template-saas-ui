import type { ReactNode } from "react";
import { Badge } from "../primitives";

export type VisualState = "loading" | "empty" | "ready" | "error";
export type VisualTone = "neutral" | "good" | "warn" | "critical";

export function VisualShell({
  title,
  state,
  emptyLabel,
  errorLabel,
  children,
}: {
  readonly title: string;
  readonly state: VisualState;
  readonly emptyLabel: string;
  readonly errorLabel: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="template-visual" aria-label={title}>
      <header className="template-visual-header">
        <h2>{title}</h2>
        <Badge>{state}</Badge>
      </header>
      {state === "loading" ? (
        <p className="template-platform-empty">Loading data</p>
      ) : state === "empty" ? (
        <p className="template-platform-empty">{emptyLabel}</p>
      ) : state === "error" ? (
        <p className="template-platform-warning">{errorLabel}</p>
      ) : (
        children
      )}
    </section>
  );
}
