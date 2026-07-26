import type { AppMapBuildInputV1, AppMapDiagnostic } from "./schema";

export const validateAppMapInput = (
  input: AppMapBuildInputV1,
): readonly AppMapDiagnostic[] => {
  void input;
  return [];
};
