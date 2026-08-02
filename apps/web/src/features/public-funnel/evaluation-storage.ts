import type { StoredEvaluation } from "./intake/evaluation-adapter";
import { makeEvaluation } from "./intake/evaluation-adapter";

const prefix = "maestro.idea-evaluation.";
const libraryKey = "maestro.idea-evaluation.library";
const versionsPrefix = "maestro.idea-evaluation.versions.";

export type StoredEvaluationVersion = {
  readonly version: number;
  readonly feedback: string | null;
  readonly evaluation: StoredEvaluation;
};

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
  const versionsKey = `${versionsPrefix}${evaluation.id}`;
  if (window.localStorage.getItem(versionsKey) === null) {
    window.localStorage.setItem(
      versionsKey,
      JSON.stringify([{ version: 1, feedback: null, evaluation }]),
    );
  }
};

export const loadEvaluationVersions = (
  id: string,
): readonly StoredEvaluationVersion[] => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(
      window.localStorage.getItem(`${versionsPrefix}${id}`) ?? "[]",
    ) as unknown;
    return Array.isArray(value) ? (value as StoredEvaluationVersion[]) : [];
  } catch {
    return [];
  }
};

export const appendEvaluationRevision = (
  id: string,
  feedback: string,
  now = new Date().toISOString(),
): StoredEvaluationVersion | null => {
  const current = loadEvaluation(id);
  if (!current) return null;
  const generated = makeEvaluation(
    {
      ...current.answers,
      differentiation: `${current.answers.differentiation}\n\nRevision evidence: ${feedback.trim()}`,
    },
    now,
  );
  const evaluation: StoredEvaluation = { ...generated, id };
  const versions = loadEvaluationVersions(id);
  const revision = {
    version: Math.max(1, versions.length) + 1,
    feedback: feedback.trim(),
    evaluation,
  };
  window.localStorage.setItem(`${prefix}${id}`, JSON.stringify(evaluation));
  window.localStorage.setItem(
    `${versionsPrefix}${id}`,
    JSON.stringify([...versions, revision]),
  );
  return revision;
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

export const deleteEvaluation = (id: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${prefix}${id}`);
  window.localStorage.removeItem(`${versionsPrefix}${id}`);
  window.localStorage.setItem(
    libraryKey,
    JSON.stringify(listEvaluationIds().filter((item) => item !== id)),
  );
};
