import {
  APP_MAP_GROUPS,
  type AppMapBuildInputV1,
  type AppMapBuildResult,
  type AppMapGroup,
  type AppMapV1,
} from "./schema";
import { parseAppMapInput } from "./validate";

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

export const serializeAppMap = (map: AppMapV1): string =>
  `${JSON.stringify(canonicalize(map), null, 2)}\n`;

const groupNodeIds = (
  input: AppMapBuildInputV1,
  group: AppMapGroup,
): readonly string[] =>
  input.batches
    .flatMap((batch) => batch.nodes)
    .filter((node) => node.group === group)
    .map((node) => node.id)
    .sort(compareText);

export const buildAppMap = (candidate: unknown): AppMapBuildResult => {
  const parsed = parseAppMapInput(candidate);
  if (!parsed.ok) return { ok: false, diagnostics: parsed.diagnostics };
  const input = parsed.input;

  const map: AppMapV1 = {
    schemaVersion: 1,
    inputManifest: input.inputManifest,
    subject: input.subject,
    groups: APP_MAP_GROUPS.map((name) => ({
      name,
      nodeIds: groupNodeIds(input, name),
    })),
    sources: input.batches
      .map((batch) => batch.source)
      .sort((left, right) => compareText(left.id, right.id)),
    nodes: input.batches
      .flatMap((batch) => batch.nodes)
      .sort((left, right) => compareText(left.id, right.id)),
    edges: input.batches
      .flatMap((batch) => batch.edges)
      .sort((left, right) => compareText(left.id, right.id)),
  };

  return { ok: true, map, json: serializeAppMap(map) };
};

export const renderAppMapSummary = (map: AppMapV1): string => {
  const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  const sections = map.groups.map((group) => {
    const rows = group.nodeIds.map((nodeId) => {
      const node = nodesById.get(nodeId);
      return `- ${node?.label ?? nodeId} (${node?.kind ?? "unknown"})`;
    });
    return [`${group.name} (${group.nodeIds.length})`, ...rows].join("\n");
  });

  return [
    `App Map: ${map.subject.id} @ ${map.subject.revision}`,
    ...sections,
    "Next action: no ownership repairs required.",
  ].join("\n\n");
};
