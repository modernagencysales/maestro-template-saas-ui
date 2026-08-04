import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  buildProtectedWorkflowJournal,
  digestProtectedDocuments,
  createProtectedControllerHttpAdapter,
  executeProtectedTransition,
  expectedProtectedTransitionDigest,
  loadProtectedTransitionJournal,
  normalizeProtectedExternalDocument,
  observeSecurityCodeownerApproval,
  observeProtectedBootstrap,
  planProtectedTransition,
  reconcileProtectedTransitionJournal,
  runProtectedTransition,
  saveProtectedTransitionJournal,
  verifyProtectedWorkflow,
  withProtectedJournalLock,
  verifyProtectedBootstrap,
  type ProtectedControllerApi,
  type ProtectedExternalDocument,
  type ProtectedTransitionJournal,
} from "./protected-bootstrap.mts";

afterEach(() => vi.unstubAllEnvs());

const sha = (value: string) => `sha256:${value.padEnd(64, "0")}` as const;

function document(
  kind: ProtectedExternalDocument["kind"],
  resourceId: string,
  canonicalBody: Readonly<Record<string, unknown>>,
): ProtectedExternalDocument {
  return normalizeProtectedExternalDocument({
    kind,
    resourceId,
    canonicalBody,
    sha256: sha("0"),
  });
}

function memoryController(initial: readonly ProtectedExternalDocument[]): {
  readonly api: ProtectedControllerApi;
  readonly documents: Map<string, ProtectedExternalDocument>;
  readonly writes: string[];
} {
  const documents = new Map(initial.map((entry) => [entry.resourceId, entry]));
  const writes: string[] = [];
  const endpoint = {
    async observe(entry: ProtectedExternalDocument) {
      const live = documents.get(entry.resourceId);
      if (!live) throw new Error(`missing ${entry.resourceId}`);
      return live;
    },
    async write(input: {
      readonly method: "PUT" | "PATCH" | "DELETE";
      readonly document: ProtectedExternalDocument;
    }) {
      writes.push(`${input.method} ${input.document.resourceId}`);
      if (input.method === "DELETE")
        documents.delete(input.document.resourceId);
      else documents.set(input.document.resourceId, input.document);
    },
  };
  return {
    api: { github: endpoint, woodpecker: endpoint, controller: endpoint },
    documents,
    writes,
  };
}

function firstStep(
  value: ProtectedTransitionJournal,
): ProtectedTransitionJournal["steps"][number] {
  const [step] = value.steps;
  if (!step) throw new Error("test journal has no step");
  return step;
}

function forwardPostimage(
  step: ProtectedTransitionJournal["steps"][number],
): readonly ProtectedExternalDocument[] {
  if (!step.forwardPostimage)
    throw new Error("test transition has no postimage");
  return step.forwardPostimage;
}

const journal: ProtectedTransitionJournal = {
  schemaVersion: 1,
  operationNonce: "018f4c42-8b8e-7b11-9a6d-1f8d2183fabc",
  operatorIdentity: "release-operator@example.test",
  createdAt: "2026-08-03T20:00:00.000Z",
  expiresAt: "2099-08-03T20:30:00.000Z",
  consumedConfirmations: [],
  observation: {
    repository: "modernagencysales/maestro-template-saas-ui",
    baseRef: "main",
    protectedBaseOid: "15d2269f2b22e3a52e3a98c481b7d69cb7fef12f",
    controllerImageDigest: sha("1"),
    appId: 123,
    canonicalContext: "ci/woodpecker/pr/verify",
    temporaryContext: "ci/woodpecker/pr/protected-bootstrap",
    woodpeckerConfigDigest: sha("2"),
    githubRulesetDigest: sha("3"),
  },
  steps: [],
};

describe("protected CI bootstrap", () => {
  it("accepts auth weakening only from a controller-observed current-head security approval", async () => {
    const approval = {
      repository: "modernagencysales/maestro-template-saas-ui",
      pullRequestNumber: 42,
      candidateCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      dedicatedAuthPolicyPr: true,
      currentHeadApproved: true,
      securityCodeownerApproved: true,
      approver: "security-owner@example.test",
    } as const;
    const controller = memoryController([]);
    const approvedApi: ProtectedControllerApi = {
      ...controller.api,
      observeSecurityCodeownerApproval: async () => approval,
    };

    await expect(
      observeSecurityCodeownerApproval({
        repository: "modernagencysales/maestro-template-saas-ui",
        pullRequestNumber: 42,
        candidateCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api: approvedApi,
      }),
    ).resolves.toEqual({
      repository: "modernagencysales/maestro-template-saas-ui",
      pullRequestNumber: 42,
      candidateCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      approver: "security-owner@example.test",
    });
    await expect(
      observeSecurityCodeownerApproval({
        repository: "modernagencysales/maestro-template-saas-ui",
        pullRequestNumber: 42,
        candidateCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).rejects.toThrow(/protected controller adapter is required/u);

    await expect(
      observeSecurityCodeownerApproval({
        repository: "modernagencysales/maestro-template-saas-ui",
        pullRequestNumber: 42,
        candidateCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api: {
          ...controller.api,
          observeSecurityCodeownerApproval: async () => ({
            ...approval,
            currentHeadApproved: false,
          }),
        },
      }),
    ).rejects.toThrow(/current-head security CODEOWNER approval/u);
  });

  it("rejects controller resource paths that escape the configured origin", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("WOODPECKER_TOKEN", "test-token");
    vi.stubEnv("PROTECTED_CONTROLLER_TOKEN", "test-token");
    vi.stubEnv("PROTECTED_CONTROLLER_API_URL", "https://controller.test");
    vi.stubEnv("PROTECTED_CONTROLLER_API_VERSION", "maestro.protected-ci/v1");
    vi.stubEnv("GITHUB_API_URL", "https://api.github.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const api = createProtectedControllerHttpAdapter();
    await expect(
      api.github.observe(document("github-ruleset", "//attacker.test/x", {})),
    ).rejects.toThrow(/escaped its base origin/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects observations that are not bound to the protected trust root", () => {
    expect(verifyProtectedBootstrap(journal.observation)).toEqual([]);
    expect(
      verifyProtectedBootstrap({ ...journal.observation, appId: 0 }),
    ).toContain("appId must be a positive integer");
    expect(
      verifyProtectedBootstrap({
        ...journal.observation,
        temporaryContext: "ci/woodpecker/pr/verify",
      }),
    ).toContain("temporaryContext must differ from canonicalContext");
  });

  it("creates an exact preview confirmation bound to live state", () => {
    const plan = planProtectedTransition({
      action: "install-temporary",
      journal,
      expectedLiveDigest: sha("4"),
    });
    expect(plan.previewFingerprint).toMatch(
      /^protected_transition_sha256:[a-f0-9]{64}$/u,
    );
    expect(plan.confirmationArgv).toEqual([
      "install-temporary",
      "--expected-live-digest",
      sha("4"),
      "--confirm",
      plan.previewFingerprint,
      "--operation-nonce",
      journal.operationNonce,
      "--operator",
      journal.operatorIdentity,
    ]);
  });

  it("rejects expired, wrong-operator, and replayed confirmations", async () => {
    const before = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      { required: "old" },
    );
    const after = document("github-ruleset", before.resourceId, {
      required: "new",
    });
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [before],
          forwardPostimage: [after],
        },
      ],
    };
    const expectedLiveDigest = digestProtectedDocuments([before]);
    const confirmation = planProtectedTransition({
      action: "install-temporary",
      journal: transition,
      expectedLiveDigest,
    }).previewFingerprint;
    const controller = memoryController([before]);
    await expect(
      runProtectedTransition({
        action: "install-temporary",
        journal: transition,
        expectedLiveDigest,
        confirmation,
        operatorIdentity: "wrong@example.test",
        api: controller.api,
      }),
    ).rejects.toThrow(/operator identity/u);
    await runProtectedTransition({
      action: "install-temporary",
      journal: transition,
      expectedLiveDigest,
      confirmation,
      operatorIdentity: journal.operatorIdentity,
      api: controller.api,
    });
    await expect(
      runProtectedTransition({
        action: "install-temporary",
        journal: transition,
        expectedLiveDigest,
        confirmation,
        operatorIdentity: journal.operatorIdentity,
        api: controller.api,
      }),
    ).rejects.toThrow(/consumed|replay/u);
    await expect(
      runProtectedTransition({
        action: "install-temporary",
        journal: { ...transition, expiresAt: "2020-01-01T00:00:00.000Z" },
        expectedLiveDigest,
        confirmation,
        operatorIdentity: journal.operatorIdentity,
        api: memoryController([before]).api,
      }),
    ).rejects.toThrow(/expired/u);
  });

  it("takes an exclusive journal lock", async () => {
    const directory = mkdtempSync(join(tmpdir(), "protected-lock-"));
    const path = join(directory, "journal.json");
    try {
      await withProtectedJournalLock(path, async () => {
        await expect(
          withProtectedJournalLock(path, async () => undefined),
        ).rejects.toThrow(/locked/u);
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects journal resources rebound to another repository", () => {
    const directory = mkdtempSync(join(tmpdir(), "protected-binding-"));
    const path = join(directory, "journal.json");
    try {
      saveProtectedTransitionJournal(path, {
        ...journal,
        steps: [
          {
            id: "install-temporary",
            preimage: [
              document(
                "github-ruleset",
                "/repos/attacker/other/rulesets/1",
                {},
              ),
            ],
            forwardPostimage: [
              document(
                "github-ruleset",
                "/repos/attacker/other/rulesets/1",
                {},
              ),
            ],
          },
        ],
      });
      expect(() => loadProtectedTransitionJournal(path)).toThrow(
        /operation binding/u,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("derives every transition document from typed repository inputs", async () => {
    const repository = "modernagencysales/maestro-template-saas-ui";
    const resources = [
      document("github-ruleset", `/repos/${repository}/rulesets/1`, {
        name: "main protection",
        enforcement: "active",
        rules: [],
      }),
      document("woodpecker-repository", `/api/repos/${repository}`, {
        id: 42,
        full_name: repository,
        trusted: false,
      }),
      document(
        "woodpecker-producer",
        `/v1/repositories/${repository}/producer`,
        {
          schema_version: 1,
          repository,
          protected_contexts: ["legacy"],
        },
      ),
      document(
        "woodpecker-secret-reference",
        `/v1/repositories/${repository}/secret-references`,
        {
          schema_version: 1,
          repository,
          references: [{ name: "GITHUB_TOKEN", events: ["pull_request"] }],
        },
      ),
    ];
    const controller = memoryController(resources);
    const built = await buildProtectedWorkflowJournal({
      repository,
      baseRef: "main",
      protectedBaseOid: journal.observation.protectedBaseOid,
      controllerImageDigest: journal.observation.controllerImageDigest,
      appId: 123,
      githubRulesetId: 1,
      temporaryContext: journal.observation.temporaryContext,
      operatorIdentity: journal.operatorIdentity,
      expiresAt: journal.expiresAt,
      operationNonce: journal.operationNonce,
      api: controller.api,
    });
    expect(built.steps.map((step) => step.id)).toEqual([
      "install-temporary",
      "enable-canonical",
      "remove-temporary",
    ]);
    expect(JSON.stringify(built)).not.toContain("never-journal-me");
    for (const step of built.steps)
      for (const resource of [
        ...step.preimage,
        ...(step.forwardPostimage ?? []),
      ])
        expect(resource.resourceId).toMatch(
          /^\/(?:repos|api\/repos|v1\/repositories)\/modernagencysales\/maestro-template-saas-ui(?:\/|$)/u,
        );

    const temporary = built.steps[0]?.forwardPostimage ?? [];
    for (const resource of temporary)
      controller.documents.set(resource.resourceId, resource);
    await expect(
      verifyProtectedWorkflow({
        journal: built,
        stage: "temporary",
        api: controller.api,
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed when provider responses do not match authoritative schemas", async () => {
    const repository = journal.observation.repository;
    const malformed = memoryController([
      document("github-ruleset", `/repos/${repository}/rulesets/1`, {}),
      document("woodpecker-repository", `/api/repos/${repository}`, {}),
      document(
        "woodpecker-producer",
        `/v1/repositories/${repository}/producer`,
        {},
      ),
      document(
        "woodpecker-secret-reference",
        `/v1/repositories/${repository}/secret-references`,
        {},
      ),
    ]);
    await expect(
      buildProtectedWorkflowJournal({
        repository,
        baseRef: "main",
        protectedBaseOid: journal.observation.protectedBaseOid,
        controllerImageDigest: journal.observation.controllerImageDigest,
        appId: 123,
        githubRulesetId: 1,
        temporaryContext: journal.observation.temporaryContext,
        operatorIdentity: journal.operatorIdentity,
        expiresAt: journal.expiresAt,
        api: malformed.api,
      }),
    ).rejects.toThrow(/provider contract/u);
  });

  it("permits an uncredentialed candidate preview but refuses a confirmed external write without an injected controller", async () => {
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [
            document(
              "github-ruleset",
              "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
              { required: "old" },
            ),
          ],
          forwardPostimage: [
            document(
              "github-ruleset",
              "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
              { required: "temporary" },
            ),
          ],
        },
      ],
    };
    const expectedLiveDigest = digestProtectedDocuments(
      firstStep(transition).preimage,
    );
    const preview = await runProtectedTransition({
      action: "install-temporary",
      journal: transition,
      expectedLiveDigest,
    });
    expect(preview.mode).toBe("preview");
    await expect(
      runProtectedTransition({
        action: "install-temporary",
        journal: transition,
        expectedLiveDigest,
        confirmation: preview.previewFingerprint,
      }),
    ).rejects.toThrow(/candidate mode cannot access external writes/u);
  });

  it("writes a redacted, restart-safe observation using only the protected controller adapter", async () => {
    const documents: ProtectedExternalDocument[] = [
      {
        kind: "github-ruleset",
        resourceId:
          "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        canonicalBody: {
          required: "ci/woodpecker/pr/verify",
          token: "never-journal-me",
        },
        sha256: sha("a"),
      },
    ];
    const controller = memoryController(documents);
    const observed = await observeProtectedBootstrap({
      observation: journal.observation,
      documents,
      api: controller.api,
    });
    expect(JSON.stringify(observed)).not.toContain("never-journal-me");
    expect(observed.steps[0]?.preimage[0]?.canonicalBody).toEqual({
      required: "ci/woodpecker/pr/verify",
    });
    const observedStep = firstStep(observed);
    const temporary = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      {
        required: "temporary",
      },
    );
    const transition = {
      ...observed,
      steps: [
        {
          id: "install-temporary",
          preimage: observedStep.preimage,
          forwardPostimage: [temporary],
          inverse: [
            {
              method: "PUT",
              resourcePath:
                "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
              canonicalBody: { required: "ci/woodpecker/pr/verify" },
            },
          ],
          inverseAllowedOnlyFrom: digestProtectedDocuments([temporary]),
        },
      ],
    } satisfies ProtectedTransitionJournal;
    const transitionStep = firstStep(transition);
    const expectedPreimage = digestProtectedDocuments(transitionStep.preimage);
    await executeProtectedTransition({
      action: "install-temporary",
      journal: transition,
      api: controller.api,
      expectedLiveDigest: expectedPreimage,
      confirmation: planProtectedTransition({
        action: "install-temporary",
        journal: transition,
        expectedLiveDigest: expectedPreimage,
      }).previewFingerprint,
    });
    expect(controller.writes).toEqual([
      "PUT /repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
    ]);
    const expectedForward = digestProtectedDocuments(
      forwardPostimage(transitionStep),
    );
    await expect(
      executeProtectedTransition({
        action: "rollback",
        journal: transition,
        api: controller.api,
        expectedLiveDigest: expectedForward,
        confirmation: planProtectedTransition({
          action: "rollback",
          journal: transition,
          expectedLiveDigest: expectedForward,
        }).previewFingerprint,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses a forward or inverse write when its compare-and-swap preimage drifted", async () => {
    const controller = memoryController([
      document(
        "github-ruleset",
        "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        { drifted: true },
      ),
    ]);
    await expect(
      executeProtectedTransition({
        action: "install-temporary",
        journal: {
          ...journal,
          steps: [{ id: "install-temporary", preimage: [] }],
        },
        api: controller.api,
        expectedLiveDigest: sha("f"),
        confirmation: sha("f"),
      }),
    ).rejects.toThrow(/missing transition step|compare-and-swap/u);
  });

  it("refuses rollback unless the journal's inverse condition names the exact forward postimage", async () => {
    const before = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      {
        required: "old",
      },
    );
    const forward = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      {
        required: "new",
      },
    );
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [before],
          forwardPostimage: [forward],
          inverse: [
            {
              method: "PUT",
              resourcePath:
                "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
              canonicalBody: before.canonicalBody,
            },
          ],
          inverseAllowedOnlyFrom: sha("wrong"),
        },
      ],
    };
    const controller = memoryController([forward]);
    const expectedLiveDigest = digestProtectedDocuments([forward]);
    await expect(
      executeProtectedTransition({
        action: "rollback",
        journal: transition,
        api: controller.api,
        expectedLiveDigest,
        confirmation: planProtectedTransition({
          action: "rollback",
          journal: transition,
          expectedLiveDigest,
        }).previewFingerprint,
      }),
    ).rejects.toThrow(/inverse condition/u);
    expect(controller.writes).toEqual([]);
  });

  it("persists per-document progress and rolls back a mixed partial write after restart", async () => {
    const first = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      { required: "old" },
    );
    const second = document(
      "woodpecker-repository",
      "/api/repos/modernagencysales/maestro-template-saas-ui",
      { trusted: false },
    );
    const forward = [
      document("github-ruleset", first.resourceId, { required: "new" }),
      document("woodpecker-repository", second.resourceId, { trusted: true }),
    ];
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [first, second],
          forwardPostimage: forward,
          inverse: [first, second].map((entry) => ({
            method: "PUT" as const,
            resourcePath: entry.resourceId,
            canonicalBody: entry.canonicalBody,
          })),
          inverseAllowedOnlyFrom: digestProtectedDocuments(forward),
        },
      ],
    };
    const controller = memoryController([first, second]);
    const originalWrite = controller.api.woodpecker.write;
    let failSecond = true;
    const crashing: ProtectedControllerApi = {
      github: controller.api.github,
      controller: controller.api.controller,
      woodpecker: {
        ...controller.api.woodpecker,
        write: async (input) => {
          if (failSecond) throw new Error("simulated controller crash");
          await originalWrite(input);
        },
      },
    };
    const directory = mkdtempSync(join(tmpdir(), "protected-partial-"));
    const path = join(directory, "journal.json");
    try {
      saveProtectedTransitionJournal(path, transition);
      const expected = digestProtectedDocuments([first, second]);
      await expect(
        executeProtectedTransition({
          action: "install-temporary",
          journal: transition,
          api: crashing,
          expectedLiveDigest: expected,
          confirmation: planProtectedTransition({
            action: "install-temporary",
            journal: transition,
            expectedLiveDigest: expected,
          }).previewFingerprint,
          persistJournal: () =>
            saveProtectedTransitionJournal(path, transition),
        }),
      ).rejects.toThrow(/simulated controller crash/u);
      const restarted = loadProtectedTransitionJournal(path);
      expect(restarted.steps[0]?.progress).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resourceId: first.resourceId,
            state: "forward-verified",
          }),
          expect.objectContaining({
            resourceId: second.resourceId,
            state: "forward-intent",
          }),
        ]),
      );
      await reconcileProtectedTransitionJournal({
        journal: restarted,
        api: crashing,
        stepId: "install-temporary",
        persistJournal: () => saveProtectedTransitionJournal(path, restarted),
      });
      expect(restarted.steps[0]?.progress?.[1]?.state).toBe("pending");
      failSecond = false;
      const mixedDigest = expectedProtectedTransitionDigest({
        action: "rollback",
        journal: restarted,
        stepId: "install-temporary",
      });
      await executeProtectedTransition({
        action: "rollback",
        stepId: "install-temporary",
        journal: restarted,
        api: crashing,
        expectedLiveDigest: mixedDigest,
        confirmation: planProtectedTransition({
          action: "rollback",
          stepId: "install-temporary",
          journal: restarted,
          expectedLiveDigest: mixedDigest,
        }).previewFingerprint,
        persistJournal: () => saveProtectedTransitionJournal(path, restarted),
      });
      expect(controller.documents.get(first.resourceId)?.sha256).toBe(
        first.sha256,
      );
      expect(controller.documents.get(second.resourceId)?.sha256).toBe(
        second.sha256,
      );
      expect(loadProtectedTransitionJournal(path).steps[0]?.progress).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ state: "inverse-verified" }),
        ]),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reconciles an apply-then-crash write before allowing recovery", async () => {
    const before = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      { required: "old" },
    );
    const after = document("github-ruleset", before.resourceId, {
      required: "new",
    });
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [before],
          forwardPostimage: [after],
          inverse: [
            {
              method: "PUT",
              resourcePath: before.resourceId,
              canonicalBody: before.canonicalBody,
            },
          ],
          inverseAllowedOnlyFrom: digestProtectedDocuments([after]),
        },
      ],
    };
    const controller = memoryController([before]);
    const appliedWrite = controller.api.github.write;
    const crashAfterApply: ProtectedControllerApi = {
      ...controller.api,
      github: {
        ...controller.api.github,
        write: async (input) => {
          await appliedWrite(input);
          throw new Error("crash after remote commit");
        },
      },
    };
    const expected = digestProtectedDocuments([before]);
    await expect(
      executeProtectedTransition({
        action: "install-temporary",
        journal: transition,
        api: crashAfterApply,
        expectedLiveDigest: expected,
        confirmation: planProtectedTransition({
          action: "install-temporary",
          journal: transition,
          expectedLiveDigest: expected,
        }).previewFingerprint,
      }),
    ).rejects.toThrow(/crash after remote commit/u);
    expect(transition.steps[0]?.progress?.[0]?.state).toBe("forward-intent");
    await reconcileProtectedTransitionJournal({
      journal: transition,
      api: controller.api,
      stepId: "install-temporary",
    });
    expect(transition.steps[0]?.progress?.[0]?.state).toBe("forward-verified");
  });

  it("durably journals both protected control planes, reloads after restart, and refuses inverse after an intervening write", async () => {
    const github = document(
      "github-ruleset",
      "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
      {
        required_contexts: ["ci/woodpecker/pr/protected-bootstrap"],
        token: "never-journal-me",
      },
    );
    const woodpecker = document(
      "woodpecker-producer",
      "/v1/repositories/modernagencysales/maestro-template-saas-ui/producer",
      {
        context: "ci/woodpecker/pr/protected-bootstrap",
      },
    );
    const controller = memoryController([github, woodpecker]);
    const observed = await observeProtectedBootstrap({
      observation: journal.observation,
      documents: [github, woodpecker],
      api: controller.api,
    });
    const preimage = firstStep(observed).preimage;
    const forwardPostimage = [
      document(
        "github-ruleset",
        "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        {
          required_contexts: ["ci/woodpecker/pr/verify"],
        },
      ),
      document(
        "woodpecker-producer",
        "/v1/repositories/modernagencysales/maestro-template-saas-ui/producer",
        {
          context: "ci/woodpecker/pr/verify",
        },
      ),
    ];
    const transition: ProtectedTransitionJournal = {
      ...observed,
      steps: [
        {
          id: "enable-canonical",
          preimage,
          forwardPostimage,
          inverse: preimage.map((entry) => ({
            method: "PUT" as const,
            resourcePath: entry.resourceId,
            canonicalBody: entry.canonicalBody,
          })),
          inverseAllowedOnlyFrom: digestProtectedDocuments(forwardPostimage),
        },
      ],
    };
    const journalDirectory = mkdtempSync(
      join(tmpdir(), "protected-bootstrap-"),
    );
    const journalPath = join(journalDirectory, "journal.json");
    try {
      saveProtectedTransitionJournal(journalPath, transition);
      expect(loadProtectedTransitionJournal(journalPath)).toEqual(transition);
      expect(
        String(
          loadProtectedTransitionJournal(journalPath).steps[0]?.preimage[0]
            ?.canonicalBody.token,
        ),
      ).toBe("undefined");

      const expectedPreimage = digestProtectedDocuments(preimage);
      await executeProtectedTransition({
        action: "enable-canonical",
        journal: loadProtectedTransitionJournal(journalPath),
        api: controller.api,
        expectedLiveDigest: expectedPreimage,
        confirmation: planProtectedTransition({
          action: "enable-canonical",
          journal: transition,
          expectedLiveDigest: expectedPreimage,
        }).previewFingerprint,
      });
      expect(controller.writes).toEqual([
        "PUT /repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        "PUT /v1/repositories/modernagencysales/maestro-template-saas-ui/producer",
      ]);

      controller.documents.set(
        "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        document(
          "github-ruleset",
          "/repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
          {
            required_contexts: ["intervening"],
          },
        ),
      );
      const expectedForward = digestProtectedDocuments(forwardPostimage);
      await expect(
        executeProtectedTransition({
          action: "rollback",
          journal: loadProtectedTransitionJournal(journalPath),
          api: controller.api,
          expectedLiveDigest: expectedForward,
          confirmation: planProtectedTransition({
            action: "rollback",
            journal: transition,
            expectedLiveDigest: expectedForward,
          }).previewFingerprint,
        }),
      ).rejects.toThrow(/compare-and-swap drift/u);
      expect(controller.writes).toEqual([
        "PUT /repos/modernagencysales/maestro-template-saas-ui/rulesets/1",
        "PUT /v1/repositories/modernagencysales/maestro-template-saas-ui/producer",
      ]);
    } finally {
      rmSync(journalDirectory, { recursive: true, force: true });
    }
  });

  it("runs typed observe/install/verify/rollback commands against fake GitHub and Woodpecker HTTP APIs", async () => {
    const directory = mkdtempSync(join(tmpdir(), "protected-bootstrap-cli-"));
    const journalPath = join(directory, "journal.json");
    const repository = journal.observation.repository;
    const state = new Map<string, Record<string, unknown>>([
      [
        `/repos/${repository}/rulesets/1`,
        {
          id: 1,
          source: repository,
          name: "main protection",
          enforcement: "active",
          rules: [],
        },
      ],
      [
        `/api/repos/${repository}`,
        { id: 42, full_name: repository, trusted: false },
      ],
      [
        `/v1/repositories/${repository}/producer`,
        {
          schema_version: 1,
          repository,
          protected_contexts: ["legacy"],
        },
      ],
      [
        `/v1/repositories/${repository}/secret-references`,
        {
          schema_version: 1,
          repository,
          references: [{ name: "GITHUB_TOKEN", events: ["pull_request"] }],
        },
      ],
    ]);
    const requests: Array<{
      readonly method: string;
      readonly path: string;
      readonly body: Record<string, unknown>;
    }> = [];
    const api = createServer(async (request, response) => {
      const path = request.url ?? "";
      if (request.method === "GET") {
        const body = state.get(path);
        if (!body) {
          response.writeHead(404).end();
          return;
        }
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(body));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<
            string,
            unknown
          >)
        : {};
      requests.push({ method: request.method ?? "", path, body });
      state.set(
        path,
        path.startsWith("/v1/") ? body : { ...state.get(path), ...body },
      );
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(state.get(path)));
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    const address = api.address();
    if (!address || typeof address === "string")
      throw new Error("missing fake API port");
    const cli = (...args: string[]) =>
      new Promise<{ status: number | null; stdout: string; stderr: string }>(
        (resolve) => {
          const child = spawn(
            process.execPath,
            [
              "--experimental-strip-types",
              "tooling/ci/protected-bootstrap.mts",
              ...args,
            ],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                NODE_ENV: "test",
                PROTECTED_BOOTSTRAP_TEST_HTTP: "1",
                GITHUB_TOKEN: "github-test-token",
                WOODPECKER_TOKEN: "woodpecker-test-token",
                PROTECTED_CONTROLLER_TOKEN: "controller-test-token",
                PROTECTED_CONTROLLER_API_VERSION: "maestro.protected-ci/v1",
                GITHUB_API_URL: `http://127.0.0.1:${address.port}`,
                WOODPECKER_SERVER: `http://127.0.0.1:${address.port}`,
                PROTECTED_CONTROLLER_API_URL: `http://127.0.0.1:${address.port}`,
              },
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (chunk) => (stdout += String(chunk)));
          child.stderr.on("data", (chunk) => (stderr += String(chunk)));
          child.on("close", (status) => resolve({ status, stdout, stderr }));
        },
      );
    try {
      const observed = await cli(
        "observe",
        "--journal",
        journalPath,
        "--repository",
        repository,
        "--base-ref",
        "main",
        "--base-oid",
        journal.observation.protectedBaseOid,
        "--controller-image-digest",
        journal.observation.controllerImageDigest,
        "--app-id",
        "123",
        "--github-ruleset-id",
        "1",
        "--temporary-context",
        journal.observation.temporaryContext,
        "--operator",
        journal.operatorIdentity,
        "--operation-nonce",
        journal.operationNonce,
        "--expires-at",
        journal.expiresAt,
      );
      expect(observed.status, observed.stderr).toBe(0);
      const observedJournal = loadProtectedTransitionJournal(journalPath);
      const expected = digestProtectedDocuments(
        observedJournal.steps[0]?.preimage ?? [],
      );
      const common = [
        "--journal",
        journalPath,
        "--expected-live-digest",
        expected,
        "--operation-nonce",
        observedJournal.operationNonce,
        "--operator",
        observedJournal.operatorIdentity,
      ];
      const preview = await cli("install-temporary", ...common);
      expect(preview.status, preview.stderr).toBe(0);
      const confirmation = JSON.parse(preview.stdout).previewFingerprint;
      const applied = await cli(
        "install-temporary",
        ...common,
        "--confirm",
        confirmation,
      );
      expect(applied.status, applied.stderr).toBe(0);
      expect(
        requests.find((entry) => entry.path.includes("/rulesets/1"))?.body,
      ).not.toHaveProperty("id");
      expect(
        requests.find((entry) => entry.path.includes("/rulesets/1"))?.body,
      ).not.toHaveProperty("source");
      const verified = await cli(
        "verify",
        "--journal",
        journalPath,
        "--stage",
        "temporary",
      );
      expect(verified.status, verified.stderr).toBe(0);
      const appliedJournal = loadProtectedTransitionJournal(journalPath);
      const forward = appliedJournal.steps[0]?.forwardPostimage ?? [];
      const rollbackDigest = digestProtectedDocuments(forward);
      const rollbackCommon = [
        "--journal",
        journalPath,
        "--step",
        "install-temporary",
        "--expected-live-digest",
        rollbackDigest,
        "--operation-nonce",
        appliedJournal.operationNonce,
        "--operator",
        appliedJournal.operatorIdentity,
      ];
      const rollbackPreview = await cli("rollback", ...rollbackCommon);
      expect(rollbackPreview.status, rollbackPreview.stderr).toBe(0);
      const rollback = await cli(
        "rollback",
        ...rollbackCommon,
        "--confirm",
        JSON.parse(rollbackPreview.stdout).previewFingerprint,
      );
      expect(rollback.status, rollback.stderr).toBe(0);
      expect(state.get(`/api/repos/${repository}`)?.trusted).toBe(false);
    } finally {
      await new Promise<void>((resolve) => api.close(() => resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
