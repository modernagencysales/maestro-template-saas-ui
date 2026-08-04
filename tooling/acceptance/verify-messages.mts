import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import {
  HookType,
  parseEnvelope,
  TestStepResultStatus,
  type Envelope,
  type GherkinDocument,
  type Pickle,
  type PickleStep,
  type Scenario,
  type Step,
  type TableRow,
} from "@cucumber/messages";
import Ajv2020 from "ajv/dist/2020.js";

import type { StablePickleKey } from "../../packages/template-core/src/productContract";
import type { ContractInventory } from "./contract-inventory";
import type { SelectionManifest } from "./selection-manifest";

export type BackendRuntimeIdentity = {
  readonly inputDigest: `sha256:${string}`;
  readonly deploymentId: string;
  readonly startNonce: string;
};

export type RuntimeManifest = {
  readonly schemaVersion: 1;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly backend: BackendRuntimeIdentity;
  readonly acceptanceRuntimeEpoch: {
    readonly schemaVersion: 1;
    readonly epochId: string;
    readonly inputDigest: `sha256:${string}`;
    readonly createdAt: string;
    readonly drainedAt?: string;
  };
};

export type ControllerContext = {
  readonly protectedBaseSha: string;
  readonly protectedInventoryDigest: `sha256:${string}`;
  readonly candidateSourceDigest: `sha256:${string}`;
  readonly fixtureOverlayDigest: `sha256:${string}`;
  readonly fixtureSupportRoot: string;
  readonly runRoot: string;
  readonly controllerImageDigest: `sha256:${string}`;
  readonly buildManifestDigest: `sha256:${string}`;
  readonly packageManager: {
    readonly executable: string;
    readonly version: string;
    readonly digest: `sha256:${string}`;
  };
  readonly runtimeEpoch: string;
  readonly handles: {
    readonly mint: string;
    readonly observe: string;
    readonly drain: string;
  };
  readonly ciTuple: {
    readonly repository: string;
    readonly mergeGroupOid: string;
    readonly pullRequestNumber: number;
    readonly appId: string;
    readonly context: string;
    readonly candidateCommit: string;
  };
  readonly origin: "protected-controller";
  readonly attestation: `cose:${string}`;
};

export type MessagesVerificationInput = {
  readonly expected: ContractInventory;
  readonly selection: SelectionManifest;
  readonly runtime: RuntimeManifest;
  readonly authority:
    | {
        readonly mode: "authoritative";
        readonly controllerContext: ControllerContext;
      }
    | { readonly mode: "focused" | "observation" };
  readonly ndjson: string;
};

export type MessagesVerdict =
  | {
      readonly ok: true;
      readonly mode: "authoritative";
      readonly ciTuple: ControllerContext["ciTuple"];
      readonly executedPickleKeys: readonly StablePickleKey[];
    }
  | {
      readonly ok: true;
      readonly mode: "focused" | "observation";
      readonly executedPickleKeys: readonly StablePickleKey[];
    }
  | { readonly ok: false; readonly findings: readonly string[] };

type JsonObject = Record<string, unknown>;
type ExpectedPickle = ContractInventory["pickles"][number];
type ExpectedStep = ExpectedPickle["steps"][number];

const require = createRequire(import.meta.url);
const messagesSchema = require("@cucumber/messages/schema") as {
  readonly properties: Readonly<Record<string, unknown>>;
};
const validateSchema = new Ajv2020({ strict: true }).compile(messagesSchema);
const knownPayloads = new Set(Object.keys(messagesSchema.properties));
const compatibleProtocol = "33.0.4";

const invariant = (condition: unknown, finding: string): asserts condition => {
  if (!condition) throw new Error(finding);
};

const exactKeys = (
  value: unknown,
  keys: readonly string[],
  context: string,
): asserts value is JsonObject => {
  invariant(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${context} must be an object`,
  );
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${context} has missing or extra fields`,
  );
};

const nonempty = (value: unknown, context: string): asserts value is string =>
  invariant(
    typeof value === "string" && value.trim() !== "",
    `${context} is empty`,
  );

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stablePickleKey = (input: {
  readonly sourceDigest: `sha256:${string}`;
  readonly uri: string;
  readonly scenarioLocation: { readonly line: number; readonly column: number };
  readonly examplesRowLocation?: {
    readonly line: number;
    readonly column: number;
  };
}): StablePickleKey =>
  `pickle_sha256:${hash(
    JSON.stringify({
      sourceDigest: input.sourceDigest,
      uri: input.uri,
      scenarioLocation: input.scenarioLocation,
      examplesRowLocation: input.examplesRowLocation ?? null,
    }),
  ).slice("sha256:".length)}`;
const stableStepKey = (
  pickleKey: StablePickleKey,
  step: PickleStep,
  index: number,
): string =>
  `step_sha256:${hash(
    JSON.stringify({
      pickleKey,
      index,
      type: step.type ?? "Unknown",
      text: step.text,
      argument: step.argument ?? null,
    }),
  ).slice("sha256:".length)}`;

const normalizeUri = (uri: string): string => {
  nonempty(uri, "selected URI");
  invariant(
    !uri.startsWith("/") &&
      !uri.includes("\\") &&
      uri === uri.normalize("NFC") &&
      !uri
        .split("/")
        .some((part) => part === "" || part === "." || part === ".."),
    `selected URI is not canonical: ${uri}`,
  );
  return uri.toLocaleLowerCase("en-US");
};

const parseMessages = (ndjson: string): readonly Envelope[] => {
  const lines = ndjson.split("\n").filter((line) => line.trim() !== "");
  invariant(lines.length > 0, "messages stream has no envelopes");
  return lines.map((line, index) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`messages line ${index + 1} is not valid JSON`);
    }
    invariant(
      raw !== null && typeof raw === "object" && !Array.isArray(raw),
      `messages line ${index + 1} must be an object`,
    );
    const keys = Object.keys(raw);
    invariant(
      keys.length === 1 && knownPayloads.has(keys[0] ?? ""),
      `messages line ${index + 1} must have exactly one known Envelope payload`,
    );
    invariant(
      validateSchema(raw),
      `messages line ${index + 1} is schema-invalid: ${new Ajv2020().errorsText(validateSchema.errors)}`,
    );
    return parseEnvelope(line);
  });
};

const values = <K extends keyof Envelope>(
  envelopes: readonly Envelope[],
  key: K,
): readonly NonNullable<Envelope[K]>[] =>
  envelopes.flatMap((envelope) => {
    const value = envelope[key];
    return value === undefined ? [] : [value as NonNullable<Envelope[K]>];
  });

const one = <T,>(items: readonly T[], context: string): T => {
  invariant(
    items.length === 1,
    `${context} requires exactly one; found ${items.length}`,
  );
  return items[0] as T;
};

type AstIndex = {
  readonly scenarios: Map<string, { scenario: Scenario; uri: string }>;
  readonly rows: Map<
    string,
    { row: TableRow; scenarioId: string; uri: string }
  >;
  readonly steps: Map<string, { step: Step; uri: string }>;
};

const astIndex = (documents: readonly GherkinDocument[]): AstIndex => {
  const scenarios = new Map<string, { scenario: Scenario; uri: string }>();
  const rows = new Map<
    string,
    { row: TableRow; scenarioId: string; uri: string }
  >();
  const steps = new Map<string, { step: Step; uri: string }>();
  const astIds = new Set<string>();
  const add = (id: string, context: string): void => {
    invariant(!astIds.has(id), `duplicate AST id ${id} (${context})`);
    astIds.add(id);
  };
  for (const document of documents) {
    const uri = document.uri;
    nonempty(uri, "GherkinDocument URI");
    const addSteps = (items: readonly Step[]): void => {
      for (const step of items) {
        add(step.id, "Step");
        steps.set(step.id, { step, uri });
      }
    };
    const addScenario = (scenario: Scenario): void => {
      add(scenario.id, "Scenario");
      scenarios.set(scenario.id, { scenario, uri });
      addSteps(scenario.steps);
      for (const examples of scenario.examples) {
        add(examples.id, "Examples");
        if (examples.tableHeader !== undefined)
          add(examples.tableHeader.id, "Examples header");
        for (const row of examples.tableBody) {
          add(row.id, "Examples row");
          rows.set(row.id, { row, scenarioId: scenario.id, uri });
        }
      }
    };
    for (const child of document.feature?.children ?? []) {
      if (child.background !== undefined) addSteps(child.background.steps);
      if (child.scenario !== undefined) addScenario(child.scenario);
      for (const ruleChild of child.rule?.children ?? []) {
        if (ruleChild.background !== undefined)
          addSteps(ruleChild.background.steps);
        if (ruleChild.scenario !== undefined) addScenario(ruleChild.scenario);
      }
    }
  }
  return { scenarios, rows, steps };
};

const assertJsonEqual = (
  actual: unknown,
  expected: unknown,
  context: string,
): void =>
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${context} does not match`,
  );

const verify = (
  input: MessagesVerificationInput,
): readonly StablePickleKey[] => {
  const envelopes = parseMessages(input.ndjson);
  const meta = one(values(envelopes, "meta"), "messages meta");
  invariant(
    meta.protocolVersion === compatibleProtocol,
    `incompatible protocol ${meta.protocolVersion}`,
  );
  invariant(
    meta.implementation?.name === "cucumber-js",
    "messages implementation is not cucumber-js",
  );

  invariant(
    input.selection.pickleKeys.length > 0,
    "selection has zero Pickles",
  );
  const expectedByKey = new Map(
    input.expected.pickles.map((pickle) => [pickle.key, pickle]),
  );
  invariant(
    expectedByKey.size === input.expected.pickles.length,
    "expected inventory has duplicate Pickle keys",
  );
  const selectedKeys = new Set(input.selection.pickleKeys);
  invariant(
    selectedKeys.size === input.selection.pickleKeys.length,
    "selection has duplicate Pickle keys",
  );
  for (const pickle of input.selection.pickles)
    invariant(
      selectedKeys.has(pickle.key) && expectedByKey.has(pickle.key),
      `selection Pickle ${pickle.key} is not expected`,
    );
  assertJsonEqual(
    [...input.selection.pickles.map((pickle) => pickle.key)].sort(),
    [...input.selection.pickleKeys].sort(),
    "selection Pickle projections",
  );

  const selectedSources = new Map<
    string,
    ContractInventory["sources"][number]
  >();
  const rawUris = new Set<string>();
  for (const source of input.selection.sources) {
    invariant(
      !rawUris.has(source.uri),
      `duplicate raw selected URI ${source.uri}`,
    );
    rawUris.add(source.uri);
    const normalized = normalizeUri(source.uri);
    invariant(
      !selectedSources.has(normalized),
      `normalized URI collision ${source.uri}`,
    );
    invariant(
      source.path === source.uri && source.bytes.length > 0,
      `selected Source ${source.uri} is incomplete`,
    );
    invariant(
      hash(source.bytes) === source.sha256,
      `selected Source digest differs for ${source.uri}`,
    );
    selectedSources.set(normalized, source);
  }
  assertJsonEqual(
    [...input.selection.sourcePaths].sort(),
    [...rawUris].sort(),
    "selection source paths",
  );

  const sources = values(envelopes, "source");
  const documents = values(envelopes, "gherkinDocument");
  invariant(
    sources.length === selectedSources.size,
    `Source count differs from selection`,
  );
  invariant(
    documents.length === selectedSources.size,
    `GherkinDocument count differs from selection`,
  );
  const seenSourceUris = new Set<string>();
  for (const source of sources) {
    invariant(
      !seenSourceUris.has(source.uri),
      `duplicate raw Source URI ${source.uri}`,
    );
    seenSourceUris.add(source.uri);
    const expectedSource = selectedSources.get(normalizeUri(source.uri));
    invariant(expectedSource !== undefined, `extra Source ${source.uri}`);
    invariant(
      source.uri === expectedSource.uri,
      `Source URI differs for ${source.uri}`,
    );
    invariant(
      source.data === expectedSource.bytes,
      `Source bytes differ for ${source.uri}`,
    );
  }
  const seenDocumentUris = new Set<string>();
  for (const document of documents) {
    const normalized = normalizeUri(document.uri);
    invariant(
      !seenDocumentUris.has(normalized),
      `duplicate GherkinDocument URI ${document.uri}`,
    );
    seenDocumentUris.add(normalized);
    invariant(
      selectedSources.has(normalized),
      `extra GherkinDocument ${document.uri}`,
    );
    invariant(
      sources.some((source) => source.uri === document.uri),
      `Source/GherkinDocument URI mismatch ${document.uri}`,
    );
  }

  const ast = astIndex(documents);
  const runtimeIds = new Set<string>();
  const addId = (id: string, context: string): void => {
    nonempty(id, `${context} id`);
    invariant(!runtimeIds.has(id), `duplicate runtime id ${id} (${context})`);
    runtimeIds.add(id);
  };
  const pickles = values(envelopes, "pickle");
  const derivedByRuntimeId = new Map<string, ExpectedPickle>();
  const derivedKeys = new Set<string>();
  for (const pickle of pickles) {
    addId(pickle.id, "Pickle");
    const source = selectedSources.get(normalizeUri(pickle.uri));
    invariant(
      source !== undefined,
      `Pickle ${pickle.id} has an unknown Source`,
    );
    invariant(
      new Set(pickle.astNodeIds).size === pickle.astNodeIds.length,
      `Pickle ${pickle.id} has duplicate AST IDs`,
    );
    const scenarioId = pickle.astNodeIds[0];
    const scenarioEntry =
      scenarioId === undefined ? undefined : ast.scenarios.get(scenarioId);
    invariant(
      scenarioEntry !== undefined && scenarioEntry.uri === pickle.uri,
      `Pickle ${pickle.id} has missing or cross-document Scenario AST ID`,
    );
    const isOutline = scenarioEntry.scenario.examples.length > 0;
    invariant(
      pickle.astNodeIds.length === (isOutline ? 2 : 1),
      `Pickle ${pickle.id} has wrong Outline AST linkage`,
    );
    const rowId = pickle.astNodeIds[1];
    const rowEntry = rowId === undefined ? undefined : ast.rows.get(rowId);
    invariant(
      !isOutline ||
        (rowEntry !== undefined &&
          rowEntry.scenarioId === scenarioId &&
          rowEntry.uri === pickle.uri),
      `Pickle ${pickle.id} has wrong Outline row`,
    );
    const scenarioLocation = scenarioEntry.scenario.location;
    invariant(
      scenarioLocation !== undefined,
      `Pickle ${pickle.id} Scenario has no location`,
    );
    const key = stablePickleKey({
      sourceDigest: source.sha256,
      uri: source.uri,
      scenarioLocation: {
        line: scenarioLocation.line,
        column: scenarioLocation.column ?? 1,
      },
      ...(rowEntry?.row.location === undefined
        ? {}
        : {
            examplesRowLocation: {
              line: rowEntry.row.location.line,
              column: rowEntry.row.location.column ?? 1,
            },
          }),
    });
    invariant(!derivedKeys.has(key), `duplicate emitted stable Pickle ${key}`);
    derivedKeys.add(key);
    const expectedPickle = expectedByKey.get(key);
    invariant(
      expectedPickle !== undefined,
      `emitted Pickle ${key} is not expected`,
    );
    invariant(
      pickle.name === expectedPickle.name,
      `Pickle ${key} name differs`,
    );
    invariant(
      pickle.steps.length === expectedPickle.steps.length,
      `Pickle ${key} has missing or duplicate PickleStep`,
    );
    for (const [index, step] of pickle.steps.entries()) {
      addId(step.id, "PickleStep");
      const expectedStep = expectedPickle.steps[index] as
        ExpectedStep | undefined;
      invariant(
        expectedStep !== undefined,
        `Pickle ${key} has an extra PickleStep`,
      );
      const astStepId = step.astNodeIds[0];
      const astStep =
        astStepId === undefined ? undefined : ast.steps.get(astStepId);
      invariant(
        astStep !== undefined && astStep.uri === pickle.uri,
        `PickleStep ${step.id} has missing or substituted AST linkage`,
      );
      invariant(
        step.astNodeIds.length === (isOutline ? 2 : 1) &&
          (!isOutline || step.astNodeIds[1] === rowId),
        `PickleStep ${step.id} has wrong Outline row`,
      );
      invariant(
        step.text === expectedStep.text &&
          (step.type ?? "Unknown") === expectedStep.type,
        `PickleStep ${step.id} differs from expected step`,
      );
      invariant(
        stableStepKey(key, step, index) === expectedStep.key,
        `PickleStep ${step.id} stable key differs`,
      );
      invariant(
        astStep.step.location?.line === expectedStep.astLocation.line &&
          (astStep.step.location.column ?? 1) ===
            expectedStep.astLocation.column,
        `PickleStep ${step.id} AST location differs`,
      );
    }
    derivedByRuntimeId.set(pickle.id, expectedPickle);
  }

  const hooks = new Map(
    values(envelopes, "hook").map(
      (hook) => (addId(hook.id, "Hook"), [hook.id, hook] as const),
    ),
  );
  const stepDefinitions = new Map(
    values(envelopes, "stepDefinition").map(
      (definition) => (
        addId(definition.id, "StepDefinition"),
        [definition.id, definition] as const
      ),
    ),
  );
  const runStarts = values(envelopes, "testRunStarted");
  const runStart = one(runStarts, "TestRunStarted");
  addId(runStart.id, "TestRunStarted");
  const testCases = values(envelopes, "testCase");
  const testCaseById = new Map(
    testCases.map((testCase) => {
      addId(testCase.id, "TestCase");
      for (const step of testCase.testSteps) addId(step.id, "TestStep");
      return [testCase.id, testCase] as const;
    }),
  );
  const executed = new Map<StablePickleKey, (typeof testCases)[number]>();
  for (const testCase of testCases) {
    const expectedPickle = derivedByRuntimeId.get(testCase.pickleId);
    invariant(
      expectedPickle !== undefined,
      `TestCase ${testCase.id} references an unresolved Pickle`,
    );
    invariant(
      selectedKeys.has(expectedPickle.key),
      `TestCase ${testCase.id} executes an unselected Pickle`,
    );
    invariant(
      !executed.has(expectedPickle.key),
      `selected Pickle ${expectedPickle.key} has multiple TestCases`,
    );
    executed.set(expectedPickle.key, testCase);
    invariant(
      testCase.testRunStartedId === runStart.id,
      `TestCase ${testCase.id} names another run`,
    );
    for (const expectedStep of expectedPickle.steps) {
      const runtimePickle = pickles.find(
        (pickle) =>
          derivedByRuntimeId.get(pickle.id)?.key === expectedPickle.key,
      ) as Pickle;
      const pickleStep = runtimePickle.steps[expectedStep.index];
      const matches = testCase.testSteps.filter(
        (step) => step.pickleStepId === pickleStep?.id,
      );
      const testStep = one(
        matches,
        `PickleStep ${pickleStep?.id} TestStep linkage`,
      );
      invariant(
        testStep.stepDefinitionIds.length === 1,
        `TestStep ${testStep.id} requires exactly one StepDefinition link`,
      );
      invariant(
        stepDefinitions.has(testStep.stepDefinitionIds[0] ?? ""),
        `TestStep ${testStep.id} has unresolved StepDefinition link`,
      );
      invariant(
        testStep.stepMatchArgumentsLists.length ===
          testStep.stepDefinitionIds.length,
        `TestStep ${testStep.id} has unaligned match arguments`,
      );
    }
    const hookSteps = testCase.testSteps.filter(
      (step) => step.hookId !== undefined,
    );
    for (const step of hookSteps)
      invariant(
        hooks.has(step.hookId ?? ""),
        `TestStep ${step.id} has unresolved Hook link`,
      );
    invariant(
      hookSteps.filter(
        (step) =>
          hooks.get(step.hookId ?? "")?.type === HookType.BEFORE_TEST_CASE,
      ).length === 1,
      `TestCase ${testCase.id} requires one Before hook`,
    );
    invariant(
      hookSteps.filter(
        (step) =>
          hooks.get(step.hookId ?? "")?.type === HookType.AFTER_TEST_CASE,
      ).length === 1,
      `TestCase ${testCase.id} requires one After hook`,
    );
  }
  assertJsonEqual(
    [...executed.keys()].sort(),
    [...selectedKeys].sort(),
    "executed selection",
  );

  for (const type of [
    HookType.BEFORE_TEST_CASE,
    HookType.AFTER_TEST_CASE,
    HookType.BEFORE_TEST_RUN,
    HookType.AFTER_TEST_RUN,
  ])
    invariant(
      [...hooks.values()].filter((hook) => hook.type === type).length === 1,
      `messages require exactly one emitted ${type} hook`,
    );

  const starts = values(envelopes, "testCaseStarted");
  const startById = new Map(
    starts.map((start) => {
      addId(start.id, "TestCaseStarted");
      invariant(
        testCaseById.has(start.testCaseId),
        `TestCaseStarted ${start.id} has unresolved TestCase linkage`,
      );
      invariant(
        start.attempt === 0,
        `TestCaseStarted ${start.id} attempt must be zero`,
      );
      return [start.id, start] as const;
    }),
  );
  for (const testCase of testCases)
    invariant(
      starts.filter((start) => start.testCaseId === testCase.id).length === 1,
      `TestCase ${testCase.id} requires one attempt-zero TestCaseStarted`,
    );

  const caseFinishes = values(envelopes, "testCaseFinished");
  for (const start of starts) {
    const finish = one(
      caseFinishes.filter((value) => value.testCaseStartedId === start.id),
      `TestCaseStarted ${start.id} finish`,
    );
    invariant(
      finish.willBeRetried === false,
      `TestCaseStarted ${start.id} willBeRetried`,
    );
  }
  invariant(
    caseFinishes.every((finish) => startById.has(finish.testCaseStartedId)),
    "orphan TestCaseFinished event",
  );

  const stepStarts = values(envelopes, "testStepStarted");
  const stepFinishes = values(envelopes, "testStepFinished");
  for (const start of starts) {
    const testCase = testCaseById.get(start.testCaseId);
    invariant(
      testCase !== undefined,
      `TestCaseStarted ${start.id} has unresolved TestCase linkage`,
    );
    for (const step of testCase.testSteps) {
      one(
        stepStarts.filter(
          (event) =>
            event.testCaseStartedId === start.id &&
            event.testStepId === step.id,
        ),
        `TestStep ${step.id} started event`,
      );
      const finish = one(
        stepFinishes.filter(
          (event) =>
            event.testCaseStartedId === start.id &&
            event.testStepId === step.id,
        ),
        `TestStep ${step.id} finished event`,
      );
      invariant(
        finish.testStepResult.status === TestStepResultStatus.PASSED,
        `TestStep ${step.id} status must be PASSED`,
      );
    }
  }
  for (const event of [...stepStarts, ...stepFinishes]) {
    const start = startById.get(event.testCaseStartedId);
    const testCase =
      start === undefined ? undefined : testCaseById.get(start.testCaseId);
    invariant(
      testCase?.testSteps.some((step) => step.id === event.testStepId),
      `orphan TestStep event ${event.testStepId}`,
    );
  }

  const runHookStarts = values(envelopes, "testRunHookStarted");
  const runHookFinishes = values(envelopes, "testRunHookFinished");
  for (const type of [HookType.BEFORE_TEST_RUN, HookType.AFTER_TEST_RUN]) {
    const hook = one(
      [...hooks.values()].filter((value) => value.type === type),
      `${type} Hook`,
    );
    const start = one(
      runHookStarts.filter((value) => value.hookId === hook.id),
      `${type} started event`,
    );
    addId(start.id, "TestRunHookStarted");
    invariant(
      start.testRunStartedId === runStart.id,
      `${type} hook names another run`,
    );
    const finish = one(
      runHookFinishes.filter(
        (value) => value.testRunHookStartedId === start.id,
      ),
      `${type} finished event`,
    );
    invariant(
      finish.result.status === TestStepResultStatus.PASSED,
      `${type} hook status must be PASSED`,
    );
  }
  const runFinish = one(
    values(envelopes, "testRunFinished"),
    "TestRunFinished",
  );
  invariant(
    runFinish.testRunStartedId === runStart.id && runFinish.success,
    "TestRunFinished is missing or unsuccessful",
  );

  const attachments = values(envelopes, "attachment");
  invariant(
    attachments.length === starts.length,
    `each selected TestCase requires exactly one attachment`,
  );
  for (const attachment of attachments) {
    invariant(
      attachment.contentEncoding === "IDENTITY" &&
        attachment.mediaType === "application/json",
      "Attachment must be identity-encoded application/json",
    );
    const start = startById.get(attachment.testCaseStartedId);
    invariant(
      start !== undefined,
      "Attachment has unresolved TestCaseStarted linkage",
    );
    const testCase = testCaseById.get(start.testCaseId);
    invariant(
      testCase !== undefined,
      `Attachment TestCaseStarted ${start.id} has unresolved TestCase linkage`,
    );
    const expectedPickle = derivedByRuntimeId.get(testCase.pickleId);
    invariant(
      expectedPickle !== undefined,
      `Attachment TestCase ${testCase.id} has unresolved Pickle linkage`,
    );
    const attachedStep = testCase.testSteps.find(
      (step) => step.id === attachment.testStepId,
    );
    invariant(
      attachedStep !== undefined &&
        hooks.get(attachedStep.hookId ?? "")?.type === HookType.AFTER_TEST_CASE,
      "Attachment testStepId is not the protected After hook",
    );
    const attachedFinish = stepFinishes.find(
      (event) =>
        event.testCaseStartedId === start.id &&
        event.testStepId === attachment.testStepId,
    );
    invariant(
      attachedFinish?.testStepResult.status === TestStepResultStatus.PASSED,
      "Attachment After hook did not pass",
    );
    invariant(
      testCase.testRunStartedId === runStart.id,
      "Attachment derives another run",
    );
    let body: unknown;
    try {
      body = JSON.parse(attachment.body);
    } catch {
      throw new Error("Attachment body is not valid JSON");
    }
    exactKeys(
      body,
      [
        "schemaVersion",
        "pickleKey",
        "checkoutSha",
        "webArtifactDigest",
        "cliArtifactDigest",
        "webBuildSourceSha",
        "cliBuildSourceSha",
        "backends",
        "scenarioNonce",
        "observations",
        "serverCorrelations",
        "hooks",
      ],
      "observation envelope",
    );
    invariant(
      body.schemaVersion === 1 && body.pickleKey === expectedPickle.key,
      "observation envelope identity differs",
    );
    invariant(
      body.checkoutSha === input.runtime.checkoutSha &&
        body.webArtifactDigest === input.runtime.webArtifactDigest &&
        body.cliArtifactDigest === input.runtime.cliArtifactDigest &&
        body.webBuildSourceSha === input.runtime.checkoutSha &&
        body.cliBuildSourceSha === input.runtime.checkoutSha,
      "observation artifact identity differs",
    );
    exactKeys(
      body.backends,
      ["controller", "web", "cli"],
      "observation backends",
    );
    for (const [name, backend] of Object.entries(body.backends)) {
      exactKeys(
        backend,
        ["inputDigest", "deploymentId", "startNonce"],
        `${name} backend`,
      );
      assertJsonEqual(
        backend,
        input.runtime.backend,
        `${name} backend identity`,
      );
      for (const value of Object.values(backend))
        nonempty(value, `${name} backend identity`);
    }
    nonempty(body.scenarioNonce, "scenario nonce");
    invariant(
      Array.isArray(body.observations),
      "observations must be an array",
    );
    const observedSteps = new Map<string, JsonObject>();
    for (const observation of body.observations) {
      invariant(
        observation !== null &&
          typeof observation === "object" &&
          !Array.isArray(observation),
        "observation must be an object",
      );
      const value = observation as JsonObject;
      const hasCorrelation = "correlationNonce" in value;
      exactKeys(
        value,
        [
          "stepKey",
          "kind",
          ...(hasCorrelation ? ["correlationNonce"] : []),
          "surfaceId",
          "transport",
        ],
        "driver observation",
      );
      nonempty(value.stepKey, "observation step key");
      invariant(
        !observedSteps.has(value.stepKey),
        `duplicate observation ${value.stepKey}`,
      );
      nonempty(value.surfaceId, "observed surface");
      nonempty(value.transport, "observed transport");
      observedSteps.set(value.stepKey, value);
    }
    const observableSteps = expectedPickle.steps.filter(
      (step) => step.type === "Action" || step.type === "Outcome",
    );
    invariant(
      observedSteps.size === observableSteps.length,
      "observations do not cover exact Action/Outcome steps",
    );
    for (const step of observableSteps) {
      const observation = observedSteps.get(step.key);
      invariant(
        observation?.kind === step.type.toLocaleLowerCase("en-US"),
        `observation kind differs for ${step.key}`,
      );
    }
    exactKeys(
      body.hooks,
      ["beforeStepKeys", "afterStepKeys"],
      "step hook markers",
    );
    assertJsonEqual(
      body.hooks.beforeStepKeys,
      expectedPickle.steps.map((step) => step.key),
      "BeforeStep attachment markers",
    );
    assertJsonEqual(
      body.hooks.afterStepKeys,
      expectedPickle.steps.map((step) => step.key),
      "AfterStep attachment markers",
    );
    invariant(
      Array.isArray(body.serverCorrelations),
      "serverCorrelations must be an array",
    );
    const actionSteps = expectedPickle.steps.filter(
      (step) => step.type === "Action",
    );
    invariant(
      body.serverCorrelations.length === actionSteps.length,
      "server correlations do not cover exact Action steps",
    );
    for (const correlation of body.serverCorrelations) {
      exactKeys(
        correlation,
        [
          "stepKey",
          "scenarioNonce",
          "correlationNonce",
          "actorPrincipalDigest",
          "surfaceId",
          "transport",
          "backend",
        ],
        "server correlation",
      );
      const observation = observedSteps.get(correlation.stepKey as string);
      invariant(
        actionSteps.some((step) => step.key === correlation.stepKey) &&
          correlation.scenarioNonce === body.scenarioNonce &&
          correlation.correlationNonce === observation?.correlationNonce &&
          correlation.surfaceId === observation?.surfaceId &&
          correlation.transport === observation?.transport,
        "server correlation linkage differs",
      );
      nonempty(correlation.actorPrincipalDigest, "actor principal digest");
      assertJsonEqual(
        correlation.backend,
        input.runtime.backend,
        "server correlation backend",
      );
    }
  }

  return [...executed.keys()].sort() as StablePickleKey[];
};

export function verifyMessages(
  input: MessagesVerificationInput,
): MessagesVerdict {
  try {
    const executedPickleKeys = verify(input);
    return input.authority.mode === "authoritative"
      ? {
          ok: true,
          mode: "authoritative",
          ciTuple: input.authority.controllerContext.ciTuple,
          executedPickleKeys,
        }
      : { ok: true, mode: input.authority.mode, executedPickleKeys };
  } catch (error) {
    return {
      ok: false,
      findings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

const help = `Usage: pnpm acceptance:verify-messages -- --help\n\nValidates a Cucumber Messages NDJSON stream through the exported verifyMessages API.`;
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--help")) console.log(help);
  else {
    console.error(help);
    process.exitCode = 1;
  }
}
