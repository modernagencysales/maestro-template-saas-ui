import { createHash } from "node:crypto";
import { generateMessages } from "@cucumber/gherkin";
import {
  IdGenerator,
  PickleStepType,
  SourceMediaType,
  type Feature,
  type GherkinDocument,
  type Location,
  type Pickle,
  type PickleStep,
  type Scenario,
  type Step,
  type Tag,
} from "@cucumber/messages";

export type ContractLifecycle = "assembling" | "admitted" | "suspended";
export type StablePickleKey = `pickle_sha256:${string}`;
export type StableStepKey = `step_sha256:${string}`;
/** @deprecated use StableStepKey. */
export type StablePickleStepKey = StableStepKey;
export type ContractTransport = "ui" | "cli" | "api" | "mcp" | "webhook";

export type ContractStepArgument =
  | { readonly dataTable: readonly (readonly string[])[] }
  | {
      readonly docString: {
        readonly mediaType?: string;
        readonly content: string;
      };
    };

export type ExpectedPickleStep = {
  readonly key: StableStepKey;
  readonly index: number;
  readonly pickleStepType: "Context" | "Action" | "Outcome" | "Unknown";
  readonly type: "Context" | "Action" | "Outcome" | "Unknown";
  readonly text: string;
  readonly argument?: ContractStepArgument;
  readonly astLocation: Required<Location>;
  readonly argumentDigest?: `sha256:${string}`;
};

export type ExpectedPickle = {
  readonly key: StablePickleKey;
  readonly sourceSha256: `sha256:${string}`;
  readonly uri: string;
  readonly sourceUri: string;
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
  readonly name: string;
  readonly scenarioLocation: Required<Location>;
  readonly examplesRowLocation?: Required<Location>;
  readonly tags: readonly string[];
  readonly transports: readonly ContractTransport[];
  readonly coverageTags: readonly `@covers_${string}`[];
  readonly denialTags: readonly (
    "@authentication" | "@authorization" | "@tenant-isolation"
  )[];
  readonly crossSurface: boolean;
  readonly steps: readonly ExpectedPickleStep[];
};

export type ContractSource = {
  readonly path: string;
  readonly uri: string;
  readonly bytes: string;
  readonly sha256: `sha256:${string}`;
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
  readonly featureName: string;
  readonly description: string;
};

export type CompiledProductContract = {
  readonly source: ContractSource;
  readonly pickles: readonly ExpectedPickle[];
};

const lifecycleTags = new Set(["@assembling", "@admitted", "@suspended"]);
const transports = ["ui", "cli", "api", "mcp", "webhook"] as const;
const transportTags = new Set(transports.map((transport) => `@${transport}`));
const denialTags = new Set([
  "@authentication",
  "@authorization",
  "@tenant-isolation",
]);
const journeyPattern = /^@journey_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const coveragePattern = /^@covers_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

const sha256 = (value: Uint8Array | string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const canonicalJson = (value: unknown): string => JSON.stringify(value);

const location = (
  value: Location | undefined,
  context: string,
): Required<Location> => {
  if (value === undefined) throw new Error(`${context} has no source location`);
  return { line: value.line, column: value.column ?? 1 };
};

const normalizeUri = (uri: string): string => {
  if (
    !uri.startsWith("features/") ||
    !uri.endsWith(".feature") ||
    uri.includes("\\") ||
    uri.startsWith("/") ||
    uri
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    uri !== uri.normalize("NFC")
  )
    throw new Error(`contract URI is not canonical: ${uri}`);
  return uri;
};

const tagsOf = (tags: readonly Tag[]): readonly string[] =>
  tags.map((tag) => tag.name);

const visitFeature = (
  feature: Feature,
  visit: (input: {
    readonly kind: "Rule" | "Scenario" | "Examples";
    readonly tags: readonly Tag[];
  }) => void,
): void => {
  const visitScenario = (scenario: Scenario): void => {
    visit({ kind: "Scenario", tags: scenario.tags });
    for (const examples of scenario.examples)
      visit({ kind: "Examples", tags: examples.tags });
  };
  for (const child of feature.children) {
    if (child.scenario !== undefined) visitScenario(child.scenario);
    if (child.rule !== undefined) {
      visit({ kind: "Rule", tags: child.rule.tags });
      for (const ruleChild of child.rule.children)
        if (ruleChild.scenario !== undefined) visitScenario(ruleChild.scenario);
    }
  }
};

const assertTagStructure = (
  feature: Feature,
): {
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
} => {
  const featureTags = tagsOf(feature.tags);
  const journeys = featureTags.filter((tag) => journeyPattern.test(tag));
  const lifecycle = featureTags.filter((tag) => lifecycleTags.has(tag));
  if (journeys.length !== 1)
    throw new Error(
      `Feature requires exactly one @journey_* tag; found ${journeys.length}`,
    );
  if (lifecycle.length !== 1)
    throw new Error(
      `Feature requires exactly one lifecycle tag; found ${lifecycle.length}`,
    );
  const [journeyTag] = journeys;
  const [lifecycleTag] = lifecycle;
  if (journeyTag === undefined || lifecycleTag === undefined)
    throw new Error("Feature contract identity is incomplete");
  for (const tag of featureTags) {
    if (
      transportTags.has(tag) ||
      coveragePattern.test(tag) ||
      tag === "@cross-surface" ||
      denialTags.has(tag)
    )
      throw new Error(`${tag} must not be placed on Feature`);
  }
  visitFeature(feature, ({ kind, tags }) => {
    for (const tag of tagsOf(tags))
      if (journeyPattern.test(tag) || lifecycleTags.has(tag))
        throw new Error(
          `${tag} is reserved for Feature and cannot be placed on ${kind}`,
        );
  });
  return {
    journeyId: journeyTag.slice(1) as `journey_${string}`,
    lifecycle: lifecycleTag.slice(1) as ContractLifecycle,
  };
};

type AstProjection = {
  readonly scenarios: ReadonlyMap<string, Scenario>;
  readonly rows: ReadonlyMap<string, Required<Location>>;
  readonly steps: ReadonlyMap<string, Step>;
};

const astProjection = (document: GherkinDocument): AstProjection => {
  const scenarios = new Map<string, Scenario>();
  const rows = new Map<string, Required<Location>>();
  const steps = new Map<string, Step>();
  const addSteps = (values: readonly Step[]): void => {
    for (const step of values) steps.set(step.id, step);
  };
  const addScenario = (scenario: Scenario): void => {
    scenarios.set(scenario.id, scenario);
    addSteps(scenario.steps);
    for (const examples of scenario.examples) {
      if (examples.tableBody.length === 0)
        throw new Error(
          `Scenario Outline ${scenario.name} requires at least one Examples row`,
        );
      for (const row of examples.tableBody)
        rows.set(row.id, location(row.location, "Examples row"));
    }
  };
  const feature = document.feature;
  if (feature === undefined) return { scenarios, rows, steps };
  for (const child of feature.children) {
    if (child.background !== undefined) addSteps(child.background.steps);
    if (child.scenario !== undefined) addScenario(child.scenario);
    if (child.rule !== undefined) {
      for (const ruleChild of child.rule.children) {
        if (ruleChild.background !== undefined)
          addSteps(ruleChild.background.steps);
        if (ruleChild.scenario !== undefined) addScenario(ruleChild.scenario);
      }
    }
  }
  return { scenarios, rows, steps };
};

const projectArgument = (
  step: PickleStep,
): ContractStepArgument | undefined => {
  const argument = step.argument;
  if (argument?.dataTable !== undefined)
    return {
      dataTable: argument.dataTable.rows.map((row) =>
        row.cells.map((cell) => cell.value),
      ),
    };
  if (argument?.docString !== undefined)
    return {
      docString: {
        ...(argument.docString.mediaType === undefined
          ? {}
          : { mediaType: argument.docString.mediaType }),
        content: argument.docString.content,
      },
    };
  return undefined;
};

const projectPickle = (input: {
  readonly pickle: Pickle;
  readonly source: ContractSource;
  readonly ast: AstProjection;
}): ExpectedPickle => {
  const scenarioId = input.pickle.astNodeIds[0];
  const scenario =
    scenarioId === undefined ? undefined : input.ast.scenarios.get(scenarioId);
  if (scenario === undefined)
    throw new Error(`Pickle ${input.pickle.name} has no Scenario AST node`);
  const scenarioLocation = location(scenario.location, "Scenario");
  const rowId = input.pickle.astNodeIds[1];
  const examplesRowLocation =
    rowId === undefined ? undefined : input.ast.rows.get(rowId);
  if (rowId !== undefined && examplesRowLocation === undefined)
    throw new Error(`Pickle ${input.pickle.name} has an unknown Examples row`);
  const digest = sha256(
    canonicalJson({
      sourceDigest: input.source.sha256,
      uri: input.source.uri,
      scenarioLocation,
      examplesRowLocation: examplesRowLocation ?? null,
    }),
  );
  const key =
    `pickle_sha256:${digest.slice("sha256:".length)}` as StablePickleKey;
  const tags = input.pickle.tags.map((tag) => tag.name);
  const pickleTransports = transports.filter((transport) =>
    tags.includes(`@${transport}`),
  );
  if (pickleTransports.length === 0)
    throw new Error(
      `Pickle ${input.pickle.name} requires at least one transport tag`,
    );
  const coverageTags = tags.filter((tag): tag is `@covers_${string}` =>
    coveragePattern.test(tag),
  );
  for (const tag of tags)
    if (tag.startsWith("@covers_") && !coveragePattern.test(tag))
      throw new Error(
        `Pickle ${input.pickle.name} has malformed coverage tag ${tag}`,
      );
  const crossSurface = tags.includes("@cross-surface");
  if (crossSurface && pickleTransports.length < 2)
    throw new Error(
      `Pickle ${input.pickle.name} is cross-surface but has one transport`,
    );
  const steps = input.pickle.steps.map((step, index): ExpectedPickleStep => {
    const type = step.type ?? PickleStepType.UNKNOWN;
    const astId = step.astNodeIds[0];
    const astStep =
      astId === undefined ? undefined : input.ast.steps.get(astId);
    if (astStep === undefined)
      throw new Error(`Pickle step ${step.text} has no Step AST node`);
    const astLocation = location(astStep.location, "Step");
    const argument = projectArgument(step);
    const projection = {
      pickleKey: key,
      index,
      type,
      text: step.text,
      argument: argument ?? null,
      astLocation,
    };
    const argumentDigest =
      argument === undefined ? undefined : sha256(canonicalJson(argument));
    return {
      key: `step_sha256:${sha256(canonicalJson(projection)).slice("sha256:".length)}` as StableStepKey,
      index,
      pickleStepType: type,
      type,
      text: step.text,
      ...(argument === undefined ? {} : { argument }),
      astLocation,
      ...(argumentDigest === undefined ? {} : { argumentDigest }),
    };
  });
  if (!steps.some((step) => step.type === PickleStepType.ACTION))
    throw new Error(`Pickle ${input.pickle.name} requires an Action step`);
  if (!steps.some((step) => step.type === PickleStepType.OUTCOME))
    throw new Error(`Pickle ${input.pickle.name} requires an Outcome step`);
  return {
    key,
    sourceSha256: input.source.sha256,
    uri: input.source.uri,
    sourceUri: input.source.uri,
    journeyId: input.source.journeyId,
    lifecycle: input.source.lifecycle,
    name: input.pickle.name,
    scenarioLocation,
    ...(examplesRowLocation === undefined ? {} : { examplesRowLocation }),
    tags,
    transports: pickleTransports,
    coverageTags,
    denialTags: tags.filter(
      (tag): tag is ExpectedPickle["denialTags"][number] => denialTags.has(tag),
    ),
    crossSurface,
    steps,
  };
};

export const compileProductContractSource = (input: {
  readonly bytes: Uint8Array;
  readonly uri: string;
}): CompiledProductContract => {
  const uri = normalizeUri(input.uri);
  const data = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  if (data.startsWith("\ufeff"))
    throw new Error(`${uri} must not contain a UTF-8 BOM`);
  if (data.includes("\r")) throw new Error(`${uri} must use LF line endings`);
  const envelopes = generateMessages(
    data,
    uri,
    SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN,
    {
      includeSource: true,
      includeGherkinDocument: true,
      includePickles: true,
      newId: IdGenerator.incrementing(),
    },
  );
  const parseErrors = envelopes.flatMap((envelope) =>
    envelope.parseError === undefined ? [] : [envelope.parseError.message],
  );
  if (parseErrors.length > 0)
    throw new Error(`${uri} is invalid Gherkin:\n${parseErrors.join("\n")}`);
  const documents = envelopes.flatMap((envelope) =>
    envelope.gherkinDocument === undefined ? [] : [envelope.gherkinDocument],
  );
  if (documents.length !== 1)
    throw new Error(`${uri} must contain exactly one Feature`);
  const [document] = documents;
  if (document === undefined)
    throw new Error(`${uri} must contain exactly one Feature`);
  const feature = document.feature;
  if (feature === undefined)
    throw new Error(`${uri} must contain exactly one Feature`);
  const identity = assertTagStructure(feature);
  const source: ContractSource = {
    uri,
    path: uri,
    bytes: data,
    sha256: sha256(input.bytes),
    ...identity,
    featureName: feature.name,
    description: feature.description,
  };
  const ast = astProjection(document);
  const pickles = envelopes.flatMap((envelope) =>
    envelope.pickle === undefined
      ? []
      : [projectPickle({ pickle: envelope.pickle, source, ast })],
  );
  if (pickles.length === 0)
    throw new Error(`${uri} must contain at least one executable Pickle`);
  return { source, pickles };
};
