export const isAdvancingSnapshotVersion = (
  currentVersion: number | undefined,
  nextVersion: number,
): boolean =>
  Number.isSafeInteger(nextVersion) &&
  nextVersion > 0 &&
  nextVersion > (currentVersion ?? 0);
