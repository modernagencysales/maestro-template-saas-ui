import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { ContractInventory } from "./contract-inventory";
import type { SelectionManifest } from "./selection-manifest";
import {
  verifyMessages,
  type MessagesVerificationInput,
  type RuntimeManifest,
} from "./verify-messages.mjs";

type JsonObject = Record<string, unknown>;
const fixtureRoot = "tooling/acceptance/fixtures/messages";
const featureUri = `${fixtureRoot}/passing.feature`;
const passingNdjson = readFileSync(`${fixtureRoot}/passing.ndjson`, "utf8");
const featureBytes = readFileSync(featureUri, "utf8");
const baseEnvelopes = passingNdjson
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line) as JsonObject);

const payload = <T,>(envelopes: readonly JsonObject[], key: string): T => {
  const envelope = envelopes.find((value) => key in value);
  if (envelope === undefined) throw new Error(`missing fixture ${key}`);
  return envelope[key] as T;
};
const required = <T,>(value: T | undefined, context: string): T => {
  if (value === undefined) throw new Error(`missing fixture ${context}`);
  return value;
};
const serialize = (envelopes: readonly JsonObject[]): string =>
  `${envelopes.map(JSON.stringify).join("\n")}\n`;
const sha256 = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const attachment = JSON.parse(
  payload<{ body: string }>(baseEnvelopes, "attachment").body,
) as {
  pickleKey: `pickle_sha256:${string}`;
  checkoutSha: string;
  webArtifactDigest: `sha256:${string}`;
  cliArtifactDigest: `sha256:${string}`;
  backends: { controller: RuntimeManifest["backend"] };
  observations: Array<{ stepKey: `step_sha256:${string}` }>;
};
const runtimePickle = payload<{
  name: string;
  tags: Array<{ name: string }>;
}>(baseEnvelopes, "pickle");
const [action, outcome] = attachment.observations;
if (action === undefined || outcome === undefined)
  throw new Error("passing fixture observations are incomplete");

const expectedPickle: ContractInventory["pickles"][number] = {
  key: attachment.pickleKey,
  sourceSha256: sha256(featureBytes),
  uri: featureUri,
  sourceUri: featureUri,
  journeyId: "journey_messages_fixture",
  lifecycle: "admitted",
  name: runtimePickle.name,
  scenarioLocation: { line: 5, column: 3 },
  examplesRowLocation: { line: 11, column: 7 },
  tags: runtimePickle.tags.map(({ name }) => name),
  transports: ["ui"],
  coverageTags: ["@covers_messages_fixture"],
  denialTags: [],
  crossSurface: false,
  steps: [
    {
      key: action.stepKey,
      index: 0,
      pickleStepType: "Action",
      type: "Action",
      text: "I increment the fixture counter by 1",
      astLocation: { line: 6, column: 5 },
    },
    {
      key: outcome.stepKey,
      index: 1,
      pickleStepType: "Outcome",
      type: "Outcome",
      text: "the fixture counter is 1",
      astLocation: { line: 7, column: 5 },
    },
  ],
};
const expected: ContractInventory = {
  schemaVersion: 1,
  sources: [
    {
      path: featureUri,
      uri: featureUri,
      bytes: featureBytes,
      sha256: sha256(featureBytes),
      journeyId: "journey_messages_fixture",
      lifecycle: "admitted",
      featureName: "Verify a genuine Cucumber Messages stream",
      description: "",
    },
  ],
  pickles: [expectedPickle],
  admittedPickleKeys: [expectedPickle.key],
  journeys: { journey_messages_fixture: "admitted" },
  authPolicyDeltas: [],
};
const selection: SelectionManifest = {
  schemaVersion: 1,
  mode: "focused",
  journeyId: "journey_messages_fixture",
  sources: expected.sources,
  pickles: expected.pickles,
  sourcePaths: [featureUri],
  pickleKeys: [expectedPickle.key],
};
const runtime: RuntimeManifest = {
  schemaVersion: 1,
  checkoutSha: attachment.checkoutSha,
  webArtifactDigest: attachment.webArtifactDigest,
  cliArtifactDigest: attachment.cliArtifactDigest,
  backend: attachment.backends.controller,
  acceptanceRuntimeEpoch: {
    schemaVersion: 1,
    epochId: "fixture-epoch",
    inputDigest: attachment.backends.controller.inputDigest,
    createdAt: "2026-08-03T00:00:00.000Z",
  },
};

const input = (ndjson = passingNdjson): MessagesVerificationInput => ({
  expected: structuredClone(expected),
  selection: structuredClone(selection),
  runtime: structuredClone(runtime),
  authority: { mode: "focused" },
  ndjson,
});
const mutated = (edit: (envelopes: JsonObject[]) => void): string => {
  const envelopes = structuredClone(baseEnvelopes);
  edit(envelopes);
  return serialize(envelopes);
};
const removePayload = (envelopes: JsonObject[], key: string): void => {
  const index = envelopes.findIndex((envelope) => key in envelope);
  if (index < 0) throw new Error(`missing fixture ${key}`);
  envelopes.splice(index, 1);
};
const editAttachment = (
  envelopes: JsonObject[],
  edit: (body: JsonObject) => void,
): void => {
  const message = payload<{ body: string }>(envelopes, "attachment");
  const body = JSON.parse(message.body) as JsonObject;
  edit(body);
  message.body = JSON.stringify(body);
};
const reject = (
  candidate: MessagesVerificationInput,
  finding: RegExp,
): void => {
  const verdict = verifyMessages(candidate);
  expect(verdict.ok).toBe(false);
  if (!verdict.ok) expect(verdict.findings.join("\n")).toMatch(finding);
};

describe("verifyMessages", () => {
  test("accepts the reviewed genuine passing stream", () => {
    expect(verifyMessages(input())).toEqual({
      ok: true,
      mode: "focused",
      executedPickleKeys: [expectedPickle.key],
    });
  });

  test("rejects malformed envelope streams before linkage", () => {
    reject(input(" \n\t\n"), /no envelopes/u);
    reject(input("{\n"), /valid JSON/u);
    reject(input("{}\n"), /exactly one known Envelope payload/u);
    reject(
      input('{"unknownPayload":{}}\n'),
      /exactly one known Envelope payload/u,
    );
    reject(
      input(
        mutated((envelopes) =>
          envelopes.push(
            structuredClone(required(envelopes[0], "first envelope")),
          ),
        ),
      ),
      /meta requires exactly one/u,
    );
    reject(
      input(
        mutated((envelopes) => {
          payload<JsonObject>(envelopes, "meta").protocolVersion = "999.0.0";
        }),
      ),
      /incompatible protocol/u,
    );
    reject(
      input(mutated((envelopes) => removePayload(envelopes, "meta"))),
      /exactly one/u,
    );
    reject(
      input(
        mutated((envelopes) => {
          const first = required(envelopes[0], "first envelope");
          first.source = structuredClone(payload(envelopes, "source"));
        }),
      ),
      /exactly one known Envelope payload/u,
    );
    reject(
      input(
        mutated((envelopes) => {
          payload<JsonObject>(envelopes, "testCaseStarted").attempt = "zero";
        }),
      ),
      /schema-invalid/u,
    );
  });

  test("rejects wrong selection and runtime linkage", () => {
    const wrong = input();
    wrong.selection = { ...wrong.selection, pickleKeys: [] };
    reject(wrong, /selection/u);
    reject(
      input(
        mutated((envelopes) => {
          payload<Record<string, unknown>>(envelopes, "testCase").pickleId =
            "missing-pickle";
        }),
      ),
      /TestCase.*Pickle/u,
    );
  });

  test("rejects failed execution and a replayed attachment", () => {
    reject(
      input(
        mutated((envelopes) => {
          payload<{ testStepResult: { status: string } }>(
            envelopes,
            "testStepFinished",
          ).testStepResult.status = "FAILED";
        }),
      ),
      /PASSED/u,
    );
    reject(
      input(
        mutated((envelopes) => {
          payload<Record<string, unknown>>(
            envelopes,
            "attachment",
          ).testCaseStartedId = "other-test-case-started";
        }),
      ),
      /protected After attachment|Attachment.*TestCaseStarted/u,
    );
  });

  test("rejects Source, AST, Outline, and PickleStep drift", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /Source bytes differ/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "source").data =
            `${featureBytes}# drift`;
        },
      ],
      [
        /extra Source|Source URI differs/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "source").uri =
            "tooling/acceptance/fixtures/messages/other.feature";
        },
      ],
      [
        /Scenario AST ID/u,
        (envelopes) => {
          payload<{ astNodeIds: string[] }>(envelopes, "pickle").astNodeIds[0] =
            "missing-scenario";
        },
      ],
      [
        /wrong Outline row/u,
        (envelopes) => {
          const pickle = payload<{ astNodeIds: string[] }>(envelopes, "pickle");
          const document = payload<{
            feature: {
              children: Array<{
                scenario: { examples: Array<{ tableHeader: { id: string } }> };
              }>;
            };
          }>(envelopes, "gherkinDocument");
          const scenario = required(
            document.feature.children[0],
            "Outline scenario",
          ).scenario;
          pickle.astNodeIds[1] = required(
            scenario.examples[0],
            "Outline Examples",
          ).tableHeader.id;
        },
      ],
      [
        /missing or duplicate PickleStep/u,
        (envelopes) => {
          payload<{ steps: unknown[] }>(envelopes, "pickle").steps.pop();
        },
      ],
      [
        /duplicate runtime id|duplicate PickleStep/u,
        (envelopes) => {
          const pickle = payload<{ steps: JsonObject[] }>(envelopes, "pickle");
          pickle.steps.push(
            structuredClone(required(pickle.steps[0], "first PickleStep")),
          );
        },
      ],
      [
        /substituted AST linkage/u,
        (envelopes) => {
          const pickle = payload<{ steps: Array<{ astNodeIds: string[] }> }>(
            envelopes,
            "pickle",
          );
          required(pickle.steps[0], "first PickleStep").astNodeIds[0] =
            "missing-step";
        },
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });

  test("rejects exact TestCase definition and Hook linkage drift", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /exactly one StepDefinition/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{ stepDefinitionIds?: string[] }>;
          }>(envelopes, "testCase");
          required(
            testCase.testSteps.find(
              (step) => step.stepDefinitionIds !== undefined,
            ),
            "Pickle-backed TestStep",
          ).stepDefinitionIds = [];
        },
      ],
      [
        /exactly one StepDefinition/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{ stepDefinitionIds?: string[] }>;
          }>(envelopes, "testCase");
          const step = required(
            testCase.testSteps.find(
              (value) => value.stepDefinitionIds !== undefined,
            ),
            "Pickle-backed TestStep",
          );
          const definitionIds = required(
            step.stepDefinitionIds,
            "StepDefinition IDs",
          );
          definitionIds.push(
            required(definitionIds[0], "first StepDefinition ID"),
          );
        },
      ],
      [
        /unresolved StepDefinition/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{ stepDefinitionIds?: string[] }>;
          }>(envelopes, "testCase");
          required(
            testCase.testSteps.find(
              (step) => step.stepDefinitionIds !== undefined,
            ),
            "Pickle-backed TestStep",
          ).stepDefinitionIds = ["missing-definition"];
        },
      ],
      [
        /unaligned match arguments/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{ stepMatchArgumentsLists?: unknown[] }>;
          }>(envelopes, "testCase");
          required(
            testCase.testSteps.find(
              (step) => step.stepMatchArgumentsLists !== undefined,
            ),
            "matched TestStep",
          ).stepMatchArgumentsLists = [];
        },
      ],
      [
        /match argument parameter type/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{
              stepMatchArgumentsLists?: Array<{
                stepMatchArguments: Array<{ parameterTypeName: string }>;
              }>;
            }>;
          }>(envelopes, "testCase");
          const step = required(
            testCase.testSteps.find(
              (value) => value.stepMatchArgumentsLists !== undefined,
            ),
            "matched TestStep",
          );
          required(
            required(
              required(step.stepMatchArgumentsLists, "match argument lists")[0],
              "match argument list",
            ).stepMatchArguments[0],
            "match argument",
          ).parameterTypeName = " ";
        },
      ],
      [
        /unresolved Hook/u,
        (envelopes) => {
          const testCase = payload<{ testSteps: Array<{ hookId?: string }> }>(
            envelopes,
            "testCase",
          );
          required(
            testCase.testSteps.find((step) => step.hookId !== undefined),
            "hook-backed TestStep",
          ).hookId = "missing-hook";
        },
      ],
      [
        /unresolved Hook|requires one Before hook/u,
        (envelopes) => {
          const hook = baseEnvelopes.find(
            (envelope) =>
              (envelope.hook as JsonObject | undefined)?.type ===
              "BEFORE_TEST_CASE",
          )?.hook as { id: string };
          removePayload(envelopes, "hook");
          const index = envelopes.findIndex(
            (envelope) =>
              (envelope.hook as JsonObject | undefined)?.id === hook.id,
          );
          if (index >= 0) envelopes.splice(index, 1);
        },
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });

  test.each([
    "UNKNOWN",
    "SKIPPED",
    "PENDING",
    "UNDEFINED",
    "AMBIGUOUS",
    "FAILED",
  ])("rejects non-PASSED TestStep status %s", (status) => {
    reject(
      input(
        mutated((envelopes) => {
          payload<{ testStepResult: { status: string } }>(
            envelopes,
            "testStepFinished",
          ).testStepResult.status = status;
        }),
      ),
      /PASSED/u,
    );
  });

  test("rejects attempts, retries, orphan events, run-hook failure, and unsuccessful finish", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /attempt must be zero/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "testCaseStarted").attempt = 1;
        },
      ],
      [
        /willBeRetried/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "testCaseFinished").willBeRetried =
            true;
        },
      ],
      [
        /started event requires exactly one|orphan TestStep/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "testStepStarted").testCaseStartedId =
            "missing-start";
        },
      ],
      [
        /hook status must be PASSED/u,
        (envelopes) => {
          payload<{ result: { status: string } }>(
            envelopes,
            "testRunHookFinished",
          ).result.status = "FAILED";
        },
      ],
      [
        /missing or unsuccessful/u,
        (envelopes) => {
          payload<JsonObject>(envelopes, "testRunFinished").success = false;
        },
      ],
      [
        /exactly one/u,
        (envelopes) => removePayload(envelopes, "testRunFinished"),
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });

  test("rejects closed observation, marker, and attachment linkage drift", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /missing or extra fields/u,
        (envelopes) =>
          editAttachment(envelopes, (body) => {
            body.extra = true;
          }),
      ],
      [
        /BeforeStep attachment markers/u,
        (envelopes) =>
          editAttachment(envelopes, (body) => {
            (body.hooks as { beforeStepKeys: string[] }).beforeStepKeys.pop();
          }),
      ],
      [
        /AfterStep attachment markers/u,
        (envelopes) =>
          editAttachment(envelopes, (body) => {
            const hooks = body.hooks as { afterStepKeys: string[] };
            hooks.afterStepKeys.push(
              required(hooks.afterStepKeys[0], "first AfterStep marker"),
            );
          }),
      ],
      [
        /artifact identity differs/u,
        (envelopes) =>
          editAttachment(envelopes, (body) => {
            body.checkoutSha = "other-checkout";
          }),
      ],
      [
        /backend identity/u,
        (envelopes) =>
          editAttachment(envelopes, (body) => {
            ((body.backends as JsonObject).web as JsonObject).deploymentId =
              "other-deployment";
          }),
      ],
      [
        /protected After attachment|not the protected After hook/u,
        (envelopes) => {
          const testCase = payload<{
            testSteps: Array<{ id: string; hookId?: string }>;
          }>(envelopes, "testCase");
          payload<JsonObject>(envelopes, "attachment").testStepId = required(
            testCase.testSteps.find((step) => step.hookId !== undefined),
            "hook-backed TestStep",
          ).id;
        },
      ],
      [
        /protected After attachment/u,
        (envelopes) => removePayload(envelopes, "attachment"),
      ],
      [
        /protected After attachment/u,
        (envelopes) => {
          envelopes.push({
            attachment: structuredClone(
              payload<JsonObject>(envelopes, "attachment"),
            ),
          });
        },
      ],
      [
        /unresolved TestCaseStarted/u,
        (envelopes) => {
          const attachment = structuredClone(
            payload<JsonObject>(envelopes, "attachment"),
          );
          attachment.testCaseStartedId = "orphan-test-case-started";
          envelopes.push({ attachment });
        },
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });

  test("rejects emitted Pickles outside the exact selection", () => {
    const candidate = input();
    const selectedKey = expectedPickle.key.replace(
      "pickle_sha256:",
      "pickle_sha256:unselected-",
    ) as typeof expectedPickle.key;
    candidate.selection = {
      ...candidate.selection,
      pickles: [
        {
          ...required(candidate.selection.pickles[0], "selected Pickle"),
          key: selectedKey,
        },
      ],
      pickleKeys: [selectedKey],
    };
    candidate.expected = {
      ...candidate.expected,
      pickles: [
        ...candidate.expected.pickles,
        {
          ...required(candidate.expected.pickles[0], "expected Pickle"),
          key: selectedKey,
        },
      ],
    };
    reject(candidate, /emitted Pickle selection/u);
  });

  test("rejects Pickle tag AST, name, and source drift", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /Pickle .* tag/u,
        (envelopes) => {
          const tags = payload<{ tags: Array<{ astNodeId: string }> }>(
            envelopes,
            "pickle",
          ).tags;
          required(tags[0], "first Pickle tag").astNodeId = "missing-tag";
        },
      ],
      [
        /Pickle .* tag/u,
        (envelopes) => {
          const tags = payload<{ tags: Array<{ name: string }> }>(
            envelopes,
            "pickle",
          ).tags;
          required(tags[0], "first Pickle tag").name = "@drift";
        },
      ],
      [
        /Pickle .* tag/u,
        (envelopes) => {
          const tags = payload<{
            tags: Array<{ astNodeId: string }>;
          }>(envelopes, "pickle").tags;
          required(tags[0], "first Pickle tag").astNodeId = required(
            tags[1],
            "second Pickle tag",
          ).astNodeId;
        },
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });

  test("rejects match argument group range and value drift", () => {
    const cases: Array<[RegExp, (group: JsonObject) => void]> = [
      [/match argument/u, (group) => (group.start = 99)],
      [/match argument|schema-invalid/u, (group) => (group.start = -1)],
      [/match argument/u, (group) => (group.value = "2")],
      [/match argument|schema-invalid/u, (group) => delete group.value],
      [
        /match argument/u,
        (group) => {
          group.children = [{ start: 0, value: "I", children: [] }];
        },
      ],
    ];
    for (const [finding, edit] of cases)
      reject(
        input(
          mutated((envelopes) => {
            const testCase = payload<{
              testSteps: Array<{
                stepMatchArgumentsLists?: Array<{
                  stepMatchArguments: Array<{ group: JsonObject }>;
                }>;
              }>;
            }>(envelopes, "testCase");
            const step = required(
              testCase.testSteps.find(
                (value) => value.stepMatchArgumentsLists !== undefined,
              ),
              "matched TestStep",
            );
            edit(
              required(
                required(
                  required(
                    step.stepMatchArgumentsLists,
                    "match argument lists",
                  )[0],
                  "match argument list",
                ).stepMatchArguments[0],
                "match argument",
              ).group,
            );
          }),
        ),
        finding,
      );
  });

  test("rejects observation transports outside the Pickle contract", () => {
    reject(
      input(
        mutated((envelopes) =>
          editAttachment(envelopes, (body) => {
            const observations = body.observations as JsonObject[];
            const serverCorrelations = body.serverCorrelations as JsonObject[];
            required(observations[0], "action observation").transport = "cli";
            required(serverCorrelations[0], "server correlation").transport =
              "cli";
          }),
        ),
      ),
      /transport/u,
    );
  });

  test("rejects duplicate per-step server correlations", () => {
    const candidate = input();
    const secondStep = required(
      required(candidate.expected.pickles[0], "expected Pickle").steps[1],
      "second expected step",
    );
    const secondActionKey = `step_sha256:${sha256(
      JSON.stringify({
        pickleKey: expectedPickle.key,
        index: 1,
        type: "Action",
        text: secondStep.text,
        argument: null,
      }),
    ).slice("sha256:".length)}` as const;
    candidate.expected = {
      ...candidate.expected,
      pickles: candidate.expected.pickles.map((pickle) => ({
        ...pickle,
        steps: pickle.steps.map((step, index) =>
          index === 1
            ? {
                ...step,
                key: secondActionKey,
                type: "Action" as const,
                pickleStepType: "Action" as const,
              }
            : step,
        ),
      })),
    };
    reject(
      {
        ...candidate,
        ndjson: mutated((envelopes) => {
          const pickle = payload<{
            steps: Array<{ type: string }>;
          }>(envelopes, "pickle");
          required(pickle.steps[1], "second PickleStep").type = "Action";
          editAttachment(envelopes, (body) => {
            const observations = body.observations as JsonObject[];
            const hooks = body.hooks as {
              beforeStepKeys: string[];
              afterStepKeys: string[];
            };
            required(observations[1], "second observation").stepKey =
              secondActionKey;
            required(observations[1], "second observation").kind = "action";
            required(observations[1], "second observation").correlationNonce =
              "second-action-correlation";
            hooks.beforeStepKeys[1] = secondActionKey;
            hooks.afterStepKeys[1] = secondActionKey;
            const correlations = body.serverCorrelations as JsonObject[];
            correlations.push(
              structuredClone(required(correlations[0], "server correlation")),
            );
          });
        }),
      },
      /server correlation/u,
    );
  });

  test("rejects extra and orphan run-hook events", () => {
    const cases: Array<[RegExp, (envelopes: JsonObject[]) => void]> = [
      [
        /RunHook|run hook|runtime id/u,
        (envelopes) => {
          const start = structuredClone(
            payload<JsonObject>(envelopes, "testRunHookStarted"),
          );
          start.id = "extra-run-hook-start";
          start.hookId = "missing-hook";
          envelopes.push({ testRunHookStarted: start });
        },
      ],
      [
        /RunHook|run hook|runtime id/u,
        (envelopes) => {
          const finish = structuredClone(
            payload<JsonObject>(envelopes, "testRunHookFinished"),
          );
          finish.testRunHookStartedId = "missing-run-hook-start";
          envelopes.push({ testRunHookFinished: finish });
        },
      ],
      [
        /duplicate runtime id/u,
        (envelopes) => {
          envelopes.push({
            testRunHookStarted: structuredClone(
              payload<JsonObject>(envelopes, "testRunHookStarted"),
            ),
          });
        },
      ],
      [
        /started event requires exactly one/u,
        (envelopes) => {
          const start = structuredClone(
            payload<JsonObject>(envelopes, "testRunHookStarted"),
          );
          const finish = structuredClone(
            payload<JsonObject>(envelopes, "testRunHookFinished"),
          );
          start.id = "extra-valid-run-hook-start";
          finish.testRunHookStartedId = start.id;
          envelopes.push(
            { testRunHookStarted: start },
            { testRunHookFinished: finish },
          );
        },
      ],
    ];
    for (const [finding, edit] of cases) reject(input(mutated(edit)), finding);
  });
});
