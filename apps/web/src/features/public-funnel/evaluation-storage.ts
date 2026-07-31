import type { StoredEvaluation } from "./intake/evaluation-adapter";

const prefix = "maestro.idea-evaluation.";
const libraryKey = "maestro.idea-evaluation.library";

export const saveEvaluation = (evaluation: StoredEvaluation): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${prefix}${evaluation.id}`,
    JSON.stringify(evaluation),
  );
  const ids = listEvaluationIds().filter((id) => id !== evaluation.id);
  window.localStorage.setItem(
    libraryKey,
    JSON.stringify([evaluation.id, ...ids]),
  );
};

export const loadEvaluation = (id: string): StoredEvaluation | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(`${prefix}${id}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredEvaluation;
  } catch {
    return null;
  }
};

export const listEvaluationIds = (): readonly string[] => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(libraryKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};
