import type { ProductJourneyManifest } from "./manifest";
import type { ReleaseSurfaceInventory } from "./graph";
import { compareCodePoints } from "./ordering";

const matches = (path: string, pattern: string): boolean =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")}$`,
  ).test(path);

export const selectAffectedJourneys = (
  catalog: readonly ProductJourneyManifest[],
  inventory: ReleaseSurfaceInventory,
  changedPaths: readonly string[],
): readonly string[] => {
  if (
    changedPaths.some(
      (path) =>
        !(inventory.classifiedPaths ?? []).some((pattern) =>
          matches(path, pattern),
        ),
    )
  )
    return catalog.map(({ id }) => id);
  const affected = new Set(
    catalog
      .filter((journey) =>
        changedPaths.some((path) =>
          journey.affectedPaths.some((pattern) => matches(path, pattern)),
        ),
      )
      .map(({ id }) => id),
  );
  if (affected.size === 0 && changedPaths.length > 0)
    return catalog.map(({ id }) => id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const journey of catalog)
      if (
        !affected.has(journey.id) &&
        journey.dependsOnJourneys.some(({ id }) => affected.has(id))
      ) {
        affected.add(journey.id);
        changed = true;
      }
  }
  return [...affected].sort(compareCodePoints);
};
