import { Badge } from "../primitives";
import { VisualShell, type VisualState } from "./shared";

export type CalendarEvent = {
  readonly id: string;
  readonly label: string;
  readonly date: string;
};

export function TemplateCalendarBoard({
  events,
  state,
}: {
  readonly events: readonly CalendarEvent[];
  readonly state: VisualState;
}) {
  return (
    <VisualShell
      title="Calendar board"
      state={state}
      emptyLabel="No events"
      errorLabel="Could not load calendar"
    >
      <div className="template-calendar-board">
        {events.map((event) => (
          <article className="template-calendar-event" key={event.id}>
            <Badge>{event.date}</Badge>
            <span>{event.label}</span>
          </article>
        ))}
      </div>
    </VisualShell>
  );
}
