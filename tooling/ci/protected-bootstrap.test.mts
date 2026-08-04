import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  digestProtectedDocuments,
  createProtectedControllerHttpAdapter,
  executeProtectedTransition,
  loadProtectedTransitionJournal,
  normalizeProtectedExternalDocument,
  observeProtectedBootstrap,
  planProtectedTransition,
  runProtectedTransition,
  saveProtectedTransitionJournal,
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
    api: { github: endpoint, woodpecker: endpoint },
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
  it("rejects controller resource paths that escape the configured origin", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("WOODPECKER_TOKEN", "test-token");
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
    ]);
  });

  it("permits an uncredentialed candidate preview but refuses a confirmed external write without an injected controller", async () => {
    const transition: ProtectedTransitionJournal = {
      ...journal,
      steps: [
        {
          id: "install-temporary",
          preimage: [
            document("github-ruleset", "rulesets/1", { required: "old" }),
          ],
          forwardPostimage: [
            document("github-ruleset", "rulesets/1", { required: "temporary" }),
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
        resourceId: "rulesets/1",
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
    const temporary = document("github-ruleset", "rulesets/1", {
      required: "temporary",
    });
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
              resourcePath: "rulesets/1",
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
    expect(controller.writes).toEqual(["PUT rulesets/1"]);
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
      document("github-ruleset", "rulesets/1", { drifted: true }),
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
    const before = document("github-ruleset", "rulesets/1", {
      required: "old",
    });
    const forward = document("github-ruleset", "rulesets/1", {
      required: "new",
    });
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
              resourcePath: "rulesets/1",
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

  it("durably journals both protected control planes, reloads after restart, and refuses inverse after an intervening write", async () => {
    const github = document("github-ruleset", "rulesets/1", {
      required_contexts: ["ci/woodpecker/pr/protected-bootstrap"],
      token: "never-journal-me",
    });
    const woodpecker = document("woodpecker-producer", "repos/123/pipeline", {
      context: "ci/woodpecker/pr/protected-bootstrap",
    });
    const controller = memoryController([github, woodpecker]);
    const observed = await observeProtectedBootstrap({
      observation: journal.observation,
      documents: [github, woodpecker],
      api: controller.api,
    });
    const preimage = firstStep(observed).preimage;
    const forwardPostimage = [
      document("github-ruleset", "rulesets/1", {
        required_contexts: ["ci/woodpecker/pr/verify"],
      }),
      document("woodpecker-producer", "repos/123/pipeline", {
        context: "ci/woodpecker/pr/verify",
      }),
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
        "PUT rulesets/1",
        "PUT repos/123/pipeline",
      ]);

      controller.documents.set(
        "rulesets/1",
        document("github-ruleset", "rulesets/1", {
          required_contexts: ["intervening"],
        }),
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
        "PUT rulesets/1",
        "PUT repos/123/pipeline",
      ]);
    } finally {
      rmSync(journalDirectory, { recursive: true, force: true });
    }
  });

  it("runs the protected CLI adapter path, reloads its journal, and rolls back a bad post-write read", () => {
    const directory = mkdtempSync(join(tmpdir(), "protected-bootstrap-cli-"));
    const statePath = join(directory, "state.json");
    const journalPath = join(directory, "journal.json");
    const adapterPath = join(directory, "adapter.mjs");
    const before = document("github-ruleset", "rulesets/1", {
      required: "old",
    });
    const forward = document("github-ruleset", "rulesets/1", {
      required: "new",
    });
    const cli = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "tooling/ci/protected-bootstrap.mts",
          ...args,
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, PROTECTED_BOOTSTRAP_TEST_STATE: statePath },
        },
      );
    try {
      writeFileSync(
        statePath,
        JSON.stringify({ documents: [before], mutateAfterWrite: false }),
      );
      writeFileSync(
        adapterPath,
        `import { readFileSync, writeFileSync } from "node:fs";
const statePath = process.env.PROTECTED_BOOTSTRAP_TEST_STATE;
const read = () => JSON.parse(readFileSync(statePath, "utf8"));
const save = (state) => writeFileSync(statePath, JSON.stringify(state));
const endpoint = {
  async observe(document) {
    const live = read().documents.find((entry) => entry.resourceId === document.resourceId);
    if (!live) throw new Error("missing " + document.resourceId);
    return live;
  },
  async write({ document }) {
    const state = read();
    const written = state.mutateAfterWrite && document.canonicalBody.required === "new"
      ? { ...document, canonicalBody: { required: "intervening" } }
      : document;
    state.documents = state.documents.map((entry) =>
      entry.resourceId === document.resourceId ? written : entry,
    );
    save(state);
  },
};
export const createProtectedControllerAdapter = () => ({ github: endpoint, woodpecker: endpoint });
`,
      );

      const observed = cli(
        "observe",
        "--journal",
        journalPath,
        "--adapter-module",
        adapterPath,
        "--observation",
        JSON.stringify(journal.observation),
        "--documents",
        JSON.stringify([before]),
      );
      expect(observed.status, observed.stderr).toBe(0);
      const observedJournal = loadProtectedTransitionJournal(journalPath);
      const observedPreimage = firstStep(observedJournal).preimage;
      const transition: ProtectedTransitionJournal = {
        ...observedJournal,
        steps: [
          {
            id: "install-temporary",
            preimage: observedPreimage,
            forwardPostimage: [forward],
            inverse: [
              {
                method: "PUT",
                resourcePath: before.resourceId,
                canonicalBody: before.canonicalBody,
              },
            ],
            inverseAllowedOnlyFrom: digestProtectedDocuments([forward]),
          },
        ],
      };
      saveProtectedTransitionJournal(journalPath, transition);
      const expected = digestProtectedDocuments(observedPreimage);
      const preview = cli(
        "install-temporary",
        "--journal",
        journalPath,
        "--adapter-module",
        adapterPath,
        "--expected-live-digest",
        expected,
      );
      expect(preview.status, preview.stderr).toBe(0);
      const confirmation = JSON.parse(preview.stdout).previewFingerprint;

      writeFileSync(
        statePath,
        JSON.stringify({
          documents: [
            document("github-ruleset", before.resourceId, {
              required: "drifted",
            }),
          ],
          mutateAfterWrite: false,
        }),
      );
      const driftedPreview = cli(
        "install-temporary",
        "--journal",
        journalPath,
        "--adapter-module",
        adapterPath,
        "--expected-live-digest",
        expected,
      );
      expect(driftedPreview.status, driftedPreview.stderr).toBe(0);
      const drifted = cli(
        "install-temporary",
        "--journal",
        journalPath,
        "--adapter-module",
        adapterPath,
        "--expected-live-digest",
        expected,
        "--confirm",
        JSON.parse(driftedPreview.stdout).previewFingerprint,
      );
      expect(drifted.status).toBe(1);
      expect(drifted.stderr).toMatch(/compare-and-swap drift/u);

      writeFileSync(
        statePath,
        JSON.stringify({ documents: [before], mutateAfterWrite: true }),
      );
      const applied = cli(
        "install-temporary",
        "--journal",
        journalPath,
        "--adapter-module",
        adapterPath,
        "--expected-live-digest",
        expected,
        "--confirm",
        confirmation,
      );
      expect(applied.status).toBe(1);
      expect(applied.stderr).toMatch(/postimage mismatch/u);
      expect(
        JSON.parse(readFileSync(statePath, "utf8")).documents[0].canonicalBody,
      ).toEqual({ required: "intervening" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
