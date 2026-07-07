import type { ReactNode } from "react";
import { Button, Input } from "../primitives";

export type PlatformCommandKind = "route" | "action";

export type PlatformCommandItem = {
  readonly id: string;
  readonly label: string;
  readonly kind: PlatformCommandKind;
  readonly keywords: readonly string[];
  readonly href?: string;
  readonly icon?: ReactNode;
  readonly onSelect?: () => void;
};

export type PlatformLabels = {
  readonly locale: string;
  readonly commandPlaceholder: string;
  readonly emptyCommandLabel: string;
};

export const buildLocalizedPlatformLabels = (
  labels: PlatformLabels,
): PlatformLabels => labels;

export const filterCommandPaletteItems = (
  items: readonly PlatformCommandItem[],
  query: string,
): readonly PlatformCommandItem[] => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return items;
  }

  return items.filter((item) =>
    [item.label, item.kind, ...item.keywords].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
};

export function TemplateCommandPalette({
  items,
  query,
  labels,
  onQueryChange,
}: {
  readonly items: readonly PlatformCommandItem[];
  readonly query: string;
  readonly labels: PlatformLabels;
  readonly onQueryChange?: (query: string) => void;
}) {
  const filtered = filterCommandPaletteItems(items, query);

  return (
    <section
      aria-label="Command palette"
      className="template-command-palette"
      data-locale={labels.locale}
    >
      <Input
        aria-label={labels.commandPlaceholder}
        onChange={(event) => onQueryChange?.(event.currentTarget.value)}
        placeholder={labels.commandPlaceholder}
        value={query}
      />
      {filtered.length === 0 ? (
        <p className="template-platform-empty">{labels.emptyCommandLabel}</p>
      ) : (
        <div className="template-command-list" role="list">
          {filtered.map((item) => (
            <Button
              className="template-command-row"
              key={item.id}
              onClick={item.onSelect}
              type="button"
              variant="cell"
            >
              <span className="template-command-icon" aria-hidden="true">
                {item.icon ?? item.label.slice(0, 1)}
              </span>
              <span>{item.label}</span>
              <span className="template-command-kind">{item.kind}</span>
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
