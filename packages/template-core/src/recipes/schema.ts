export const RECIPE_SCHEMA_VERSION = 2 as const;
export const RECIPE_EXECUTION_VERSION = 1 as const;
export type RecipeArgumentBinding =
  | { readonly source: "answer"; readonly answerId: string }
  | { readonly source: "literal"; readonly value: string | boolean };
export type RecipeExecution = {
  readonly version: typeof RECIPE_EXECUTION_VERSION;
  readonly mode: "greenfield-additive";
  readonly steps: readonly {
    readonly id: string;
    readonly generatorId: string;
    readonly arguments: Readonly<Record<string, RecipeArgumentBinding>>;
  }[];
};

export type RecipeAvailability =
  | { readonly status: "available" }
  | {
      readonly status: "unavailable";
      readonly reason: string;
      readonly requiredSemanticPrimitives: readonly string[];
    }
  | {
      readonly status: "template-gap";
      readonly reason: string;
      readonly backlogRef: string;
    };

export type OutcomeRecipe = {
  readonly schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  readonly id: string;
  readonly aliases: readonly string[];
  readonly outcome: string;
  readonly availability: RecipeAvailability;
  readonly consequentialQuestions: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly why: string;
    readonly answerKind: "text" | "choice" | "boolean";
    readonly choices?: readonly string[];
  }[];
  readonly canonicalSystems: readonly {
    readonly id: string;
    readonly disposition: "reuse" | "extend";
    readonly role: string;
  }[];
  readonly classifications: readonly {
    readonly kind: "fixture-to-real" | "pattern-instance" | "template-gap";
    readonly target: string;
    readonly evidence: string;
  }[];
  readonly generatorPreviews: readonly {
    readonly generatorId: string;
    readonly command: string;
    readonly purpose: string;
  }[];
  readonly execution?: RecipeExecution;
  readonly providerReferences: readonly {
    readonly id: string;
    readonly posture: "none" | "fake-safe" | "optional-reviewed";
    readonly note: string;
  }[];
  readonly migrationRisks: readonly string[];
  readonly focusedGates: readonly string[];
  readonly doneState: readonly string[];
  readonly minimumPrimitive: string;
  readonly whenNotToUse: readonly string[];
  readonly escalationTriggers: readonly {
    readonly from: "table-route" | "capability" | "workflow";
    readonly to: "capability" | "workflow" | "agent";
    readonly when: string;
  }[];
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown, label: string): RecordValue => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new RangeError(`${label} must be an object`);
  return value as RecordValue;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new RangeError(`${label} must be nonempty text`);
  return value;
};
const list = <T>(
  value: unknown,
  label: string,
  parse: (entry: unknown, index: number) => T,
): readonly T[] => {
  if (!Array.isArray(value) || value.length === 0)
    throw new RangeError(`${label} must be a nonempty array`);
  return Object.freeze(value.map(parse));
};
const textList = (value: unknown, label: string): readonly string[] => {
  const values = list(value, label, (entry) => text(entry, label));
  if (new Set(values).size !== values.length)
    throw new RangeError(`${label} must not contain duplicates`);
  return values;
};
const member = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] => {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) throw new RangeError(`invalid ${label}`);
  return found;
};

export function parseOutcomeRecipe(value: unknown): OutcomeRecipe {
  const input = record(value, "recipe");
  if (input.schemaVersion !== RECIPE_SCHEMA_VERSION)
    throw new RangeError("invalid recipe schema version");
  const availabilityInput = record(input.availability, "availability");
  const status = member(
    availabilityInput.status,
    ["available", "unavailable", "template-gap"] as const,
    "availability status",
  );
  const availability: RecipeAvailability =
    status === "available"
      ? { status }
      : status === "unavailable"
        ? {
            status,
            reason: text(availabilityInput.reason, "unavailable reason"),
            requiredSemanticPrimitives: textList(
              availabilityInput.requiredSemanticPrimitives,
              "required semantic primitives",
            ),
          }
        : {
            status,
            reason: text(availabilityInput.reason, "template-gap reason"),
            backlogRef: text(availabilityInput.backlogRef, "backlog ref"),
          };
  const consequentialQuestions = list(
    input.consequentialQuestions,
    "consequential questions",
    (entry) => {
      const question = record(entry, "question");
      const answerKind = member(
        question.answerKind,
        ["text", "choice", "boolean"] as const,
        "answer kind",
      );
      return {
        id: text(question.id, "question id"),
        prompt: text(question.prompt, "question prompt"),
        why: text(question.why, "question reason"),
        answerKind,
        ...(answerKind === "choice"
          ? { choices: textList(question.choices, "question choices") }
          : {}),
      };
    },
  );
  const questionIds = new Set(consequentialQuestions.map(({ id }) => id));
  const execution = parseExecution(input.execution, questionIds);
  return Object.freeze({
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: text(input.id, "recipe id"),
    aliases: textList(input.aliases, "recipe aliases"),
    outcome: text(input.outcome, "recipe outcome"),
    availability,
    consequentialQuestions,
    canonicalSystems: parseObjects(
      input.canonicalSystems,
      "canonical systems",
      (entry) => ({
        id: text(entry.id, "system id"),
        disposition: member(
          entry.disposition,
          ["reuse", "extend"] as const,
          "disposition",
        ),
        role: text(entry.role, "system role"),
      }),
    ),
    classifications: parseObjects(
      input.classifications,
      "classifications",
      (entry) => ({
        kind: member(
          entry.kind,
          ["fixture-to-real", "pattern-instance", "template-gap"] as const,
          "classification",
        ),
        target: text(entry.target, "classification target"),
        evidence: text(entry.evidence, "classification evidence"),
      }),
    ),
    generatorPreviews: parseObjects(
      input.generatorPreviews,
      "generator previews",
      (entry) => ({
        generatorId: text(entry.generatorId, "generator id"),
        command: text(entry.command, "generator command"),
        purpose: text(entry.purpose, "generator purpose"),
      }),
    ),
    ...(execution === undefined ? {} : { execution }),
    providerReferences: parseObjects(
      input.providerReferences,
      "provider references",
      (entry) => ({
        id: text(entry.id, "provider id"),
        posture: member(
          entry.posture,
          ["none", "fake-safe", "optional-reviewed"] as const,
          "provider posture",
        ),
        note: text(entry.note, "provider note"),
      }),
    ),
    migrationRisks: textList(input.migrationRisks, "migration risks"),
    focusedGates: textList(input.focusedGates, "focused gates"),
    doneState: textList(input.doneState, "done state"),
    minimumPrimitive: text(input.minimumPrimitive, "minimum primitive"),
    whenNotToUse: textList(input.whenNotToUse, "when not to use"),
    escalationTriggers: parseObjects(
      input.escalationTriggers,
      "escalation triggers",
      (entry) => ({
        from: member(
          entry.from,
          ["table-route", "capability", "workflow"] as const,
          "escalation source",
        ),
        to: member(
          entry.to,
          ["capability", "workflow", "agent"] as const,
          "escalation target",
        ),
        when: text(entry.when, "escalation trigger"),
      }),
    ),
  });
}

function parseExecution(
  value: unknown,
  questionIds: ReadonlySet<string>,
): RecipeExecution | undefined {
  if (value === undefined) return undefined;
  const input = record(value, "recipe execution");
  if (input.version !== RECIPE_EXECUTION_VERSION)
    throw new RangeError("invalid recipe execution version");
  const steps = list(input.steps, "recipe execution steps", (entry) => {
    const step = record(entry, "recipe execution step");
    const bindings = record(step.arguments, "recipe execution arguments");
    const args = Object.fromEntries(
      Object.entries(bindings).map(([name, bindingValue]) => {
        const binding = record(bindingValue, `recipe argument ${name}`);
        const source = member(
          binding.source,
          ["answer", "literal"] as const,
          "recipe argument source",
        );
        if (source === "answer") {
          const answerId = text(binding.answerId, "recipe answer id");
          if (!questionIds.has(answerId))
            throw new RangeError(
              `recipe argument references unknown answer ${answerId}`,
            );
          return [name, { source, answerId }] as const;
        }
        if (
          typeof binding.value !== "string" &&
          typeof binding.value !== "boolean"
        )
          throw new RangeError("recipe literal must be text or boolean");
        return [name, { source, value: binding.value }] as const;
      }),
    );
    if (Object.keys(args).length === 0)
      throw new RangeError("recipe execution arguments must be nonempty");
    return {
      id: text(step.id, "recipe execution step id"),
      generatorId: text(step.generatorId, "recipe execution generator id"),
      arguments: Object.freeze(args),
    };
  });
  if (new Set(steps.map(({ id }) => id)).size !== steps.length)
    throw new RangeError("recipe execution step ids must be unique");
  return Object.freeze({
    version: RECIPE_EXECUTION_VERSION,
    mode: member(
      input.mode,
      ["greenfield-additive"] as const,
      "recipe execution mode",
    ),
    steps,
  });
}

function parseObjects<T>(
  value: unknown,
  label: string,
  parse: (entry: RecordValue) => T,
): readonly T[] {
  return list(value, label, (entry) => parse(record(entry, label)));
}
