export const isCurrentPageRevision = (
  actualUpdatedAt: number,
  expectedUpdatedAt: number,
): boolean => actualUpdatedAt === expectedUpdatedAt;

export const nextPageUpdatedAt = (current: number, clockNow: number): number =>
  Math.max(current + 1, clockNow);
