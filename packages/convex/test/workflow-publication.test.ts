import { describe, expect, it } from "vitest";

import {
  addCapabilityRelease,
  addWorkflowRelease,
  assertWorkflowStartBinding,
  defineCapabilityRelease,
  definePublicationRegistry,
  defineWorkflowRelease,
  publishCapability,
  publishWorkflow,
  publicationTestOnly,
  resolveWorkflowCapabilityForRun,
  resolveWorkflowForRun,
  resolveWorkflowStart,
  retireWorkflow,
  type CapabilityRelease,
  type ChecksummedModule,
  type GeneratedPublicationAuthority,
  type WorkflowRelease,
} from "../confect/workflows/_kit/publication";
import { sha256Hex } from "../confect/shared/sha256";

const sha = (digit: string) => digit.repeat(64);

const requiredFixtureValue = <Value>(value: Value | undefined): Value => {
  if (value === undefined) throw new Error("Publication fixture is incomplete");
  return value;
};

const sourceModule = (module: string, source: string): ChecksummedModule => ({
  module,
  checksum: sha256Hex(source),
});

const authority = (
  kind: "workflow" | "capability",
  logicalId: string,
  version: number,
  modules: readonly ChecksummedModule[],
): GeneratedPublicationAuthority => {
  const unsignedClosure = {
    roots: modules.map(({ module }) => module).sort(),
    modules: modules
      .map(({ module, checksum }) => ({ path: module, checksum }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
  const sourceClosure = {
    ...unsignedClosure,
    checksum:
      publicationTestOnly.checksumSourceClosureDescriptor(unsignedClosure),
  };
  return {
    schemaVersion: 1,
    sourceClosure,
    descriptorChecksum: publicationTestOnly.checksumAuthorityDescriptor(
      kind,
      logicalId,
      version,
      sourceClosure,
    ),
  };
};

const capability = (version: number, lifecycle: "draft" | "published") => {
  const dependencyManifest = [
    sourceModule(
      `domain/fixtureEcho/v${version}`,
      `export const fixtureEchoVersion = ${version};\n`,
    ),
  ];
  const candidate: CapabilityRelease<string> = {
    logicalKey: "capability.fixture.echo",
    version,
    lifecycle,
    authority: authority(
      "capability",
      "capability.fixture.echo",
      version,
      dependencyManifest,
    ),
    functionRef: `capabilities/_versions/fixtureEcho/v${version}:run`,
    functionReference: `capabilities/_versions/fixtureEcho/v${version}:run`,
    argsSchema: `fixtureEcho.v${version}.args`,
    returnSchema: `fixtureEcho.v${version}.return`,
    effectManifest: { kind: "mutation", external: false },
    dependencyManifest,
    sourceClosureChecksum: authority(
      "capability",
      "capability.fixture.echo",
      version,
      dependencyManifest,
    ).sourceClosure.checksum,
    releaseChecksum: "",
    semanticComplete: true,
    isolatedFixture: true,
  };
  return defineCapabilityRelease({
    ...candidate,
    releaseChecksum: publicationTestOnly.checksumCapabilityRelease(candidate),
  });
};

const workflow = (
  version: number,
  capabilityVersion: number,
  lifecycle: "draft" | "published",
) => {
  const graphSource = JSON.stringify({
    id: "workflow.fixture.publication",
    version,
  });
  const interpreter = sourceModule(
    "workflows/_kit/graphRunnerV2",
    "export const graphRunnerVersion = 2;\n",
  );
  const runnerFunctionReference = `workflowRunners/fixturePublication/v${version}:run`;
  const sourceManifest = [
    sourceModule(
      `workflows/fixturePublication/v${version}.graph.ts`,
      graphSource,
    ),
    sourceModule(
      `packages/convex/convex/workflowRunners/fixturePublication/v${version}.ts`,
      `export const runnerVersion = ${version};\n`,
    ),
    interpreter,
  ];
  const candidate: WorkflowRelease<string, string> = {
    workflowId: "workflow.fixture.publication",
    version,
    lifecycle,
    authority: authority(
      "workflow",
      "workflow.fixture.publication",
      version,
      sourceManifest,
    ),
    graphModule: `workflows/fixturePublication/v${version}.graph.ts`,
    graphHash: sha256Hex(graphSource),
    runner: {
      ref: runnerFunctionReference,
      module: runnerFunctionReference,
      functionReference: runnerFunctionReference,
    },
    events: [
      {
        definition: "event.fixture.approval.v1",
        validator: "fixtureApproval.v1",
      },
    ],
    completion: {
      ref: `workflowRunners/fixturePublication/v${version}:onComplete`,
      module: `workflowRunners/fixturePublication/v${version}:onComplete`,
      version: 1,
    },
    kickoffProfiles: ["eager-first-poll", "queued"],
    capabilityBindings: [
      {
        logicalKey: "capability.fixture.echo",
        version: capabilityVersion,
        releaseChecksum: capability(capabilityVersion, "published")
          .releaseChecksum,
      },
    ],
    subworkflowBindings: [],
    runtimeVersion: "maestro-workflow-runtime.v2",
    interpreter,
    lifecycleContractVersion: 1,
    sourceClosureChecksum: authority(
      "workflow",
      "workflow.fixture.publication",
      version,
      sourceManifest,
    ).sourceClosure.checksum,
    releaseChecksum: "",
    stableStepNames: ["start.v2", "fixture-echo.v2", "receipt.v2"],
    semanticComplete: true,
    isolatedFixture: true,
  };
  return defineWorkflowRelease({
    ...candidate,
    releaseChecksum: publicationTestOnly.checksumWorkflowRelease(candidate),
  });
};

const resealWorkflow = <RunnerRef, CompletionRef>(
  release: WorkflowRelease<RunnerRef, CompletionRef>,
): WorkflowRelease<RunnerRef, CompletionRef> =>
  defineWorkflowRelease({
    ...release,
    releaseChecksum: publicationTestOnly.checksumWorkflowRelease(release),
  });

describe("immutable workflow publication registry", () => {
  it("keeps v1 graph, runner, and pending capability bindings after v2", () => {
    const v1Capability = capability(1, "published");
    const v2Capability = capability(2, "published");
    const v1Workflow = workflow(1, 1, "published");
    const v2Workflow = workflow(2, 2, "published");
    const registry = definePublicationRegistry({
      capabilities: [v1Capability, v2Capability],
      workflows: [v1Workflow, v2Workflow],
    });

    const resolvedV1 = resolveWorkflowStart(registry, v1Workflow.workflowId, 1);
    expect(resolvedV1.graphHash).toBe(v1Workflow.graphHash);
    expect(resolvedV1.runner.ref).toContain("/v1:run");
    expect(
      resolveWorkflowCapabilityForRun(
        registry,
        resolvedV1,
        "capability.fixture.echo",
      ).functionRef,
    ).toContain("/v1:run");
  });

  it("publishes an additive v2 draft without changing published v1", () => {
    const v1Capability = capability(1, "published");
    const v2Capability = capability(2, "draft");
    const v1Workflow = workflow(1, 1, "published");
    const v2Workflow = workflow(2, 2, "draft");
    const base = definePublicationRegistry({
      capabilities: [v1Capability],
      workflows: [v1Workflow],
    });
    const withDrafts = addWorkflowRelease(
      addCapabilityRelease(base, v2Capability),
      v2Workflow,
    );

    expect(resolveWorkflowStart(withDrafts, v1Workflow.workflowId, 1)).toEqual(
      v1Workflow,
    );
    expect(() => publishWorkflow(withDrafts, v2Workflow.workflowId, 2)).toThrow(
      /dependency.*draft/i,
    );
    const withCapabilityV2 = publishCapability(
      withDrafts,
      v2Capability.logicalKey,
      2,
    );
    const published = publishWorkflow(
      withCapabilityV2,
      v2Workflow.workflowId,
      2,
    );
    expect(
      resolveWorkflowStart(published, v2Workflow.workflowId, 2),
    ).toMatchObject({ lifecycle: "published", version: 2 });
    expect(resolveWorkflowStart(published, v1Workflow.workflowId, 1)).toEqual(
      v1Workflow,
    );
  });

  it("rejects incomplete releases and published-version overwrite", () => {
    const incomplete = resealWorkflow({
      ...workflow(1, 1, "draft"),
      semanticComplete: false,
    });
    const registry = definePublicationRegistry({
      capabilities: [capability(1, "published")],
      workflows: [incomplete],
    });

    expect(() => publishWorkflow(registry, incomplete.workflowId, 1)).toThrow(
      /semantic contract/i,
    );

    const published = definePublicationRegistry({
      capabilities: [capability(1, "published")],
      workflows: [workflow(1, 1, "published")],
    });
    expect(() =>
      addWorkflowRelease(published, workflow(1, 1, "published")),
    ).toThrow(/immutable/i);
  });

  it("blocks new starts after retirement but preserves active-run closure", () => {
    const release = workflow(1, 1, "published");
    const registry = definePublicationRegistry({
      capabilities: [capability(1, "published")],
      workflows: [release],
    });
    const retired = retireWorkflow(registry, release.workflowId, 1);

    expect(() => resolveWorkflowStart(retired, release.workflowId, 1)).toThrow(
      /retired/i,
    );
    expect(resolveWorkflowForRun(retired, release.workflowId, 1)).toMatchObject(
      {
        lifecycle: "retired",
        runner: release.runner,
      },
    );
    expect(
      resolveWorkflowCapabilityForRun(
        retired,
        resolveWorkflowForRun(retired, release.workflowId, 1),
        "capability.fixture.echo",
      ).version,
    ).toBe(1);
  });

  it("requires generated start inputs to match the exact published entry", () => {
    const release = workflow(1, 1, "published");
    const registry = definePublicationRegistry({
      capabilities: [capability(1, "published")],
      workflows: [release],
    });
    expect(
      assertWorkflowStartBinding(registry, {
        workflowId: release.workflowId,
        workflowVersion: release.version,
        graphHash: release.graphHash,
        runnerRef: release.runner.ref,
        runnerModule: release.runner.module,
        runnerFunctionReference: release.runner.functionReference,
        releaseChecksum: release.releaseChecksum,
        kickoffProfile: "queued",
      }),
    ).toEqual(release);
    expect(() =>
      assertWorkflowStartBinding(registry, {
        workflowId: release.workflowId,
        workflowVersion: release.version,
        graphHash: sha("9"),
        runnerRef: release.runner.ref,
        runnerModule: release.runner.module,
        runnerFunctionReference: release.runner.functionReference,
        releaseChecksum: release.releaseChecksum,
        kickoffProfile: "queued",
      }),
    ).toThrow(/graph hash/i);
  });

  it("rejects a forged runner reference that reuses the release checksum", () => {
    const release = workflow(1, 1, "published");

    expect(() =>
      defineWorkflowRelease({
        ...release,
        runner: {
          ...release.runner,
          ref: "workflowRunners/attacker/v1:run",
        },
      }),
    ).toThrow(/runner reference.*stable generated identity/i);
  });

  it("clones and deeply freezes nested publication content", () => {
    const release = workflow(1, 1, "published");
    const runner = { ...release.runner };
    const event = { ...requiredFixtureValue(release.events[0]) };
    const capabilityBinding = {
      ...requiredFixtureValue(release.capabilityBindings[0]),
    };
    const source = {
      ...requiredFixtureValue(release.authority.sourceClosure.modules[0]),
    };
    const sourceClosure = {
      ...release.authority.sourceClosure,
      modules: release.authority.sourceClosure.modules.map((module, index) =>
        index === 0 ? source : module,
      ),
    };
    const immutable = defineWorkflowRelease({
      ...release,
      runner,
      events: [event],
      capabilityBindings: [capabilityBinding],
      authority: { ...release.authority, sourceClosure },
    });

    runner.module = "attacker/runner";
    event.validator = "attacker.validator";
    capabilityBinding.logicalKey = "capability.attacker";
    source.path = "attacker/source.ts";

    expect(immutable.runner.module).toBe(release.runner.module);
    expect(immutable.events[0]?.validator).toBe(release.events[0]?.validator);
    expect(immutable.capabilityBindings[0]?.logicalKey).toBe(
      release.capabilityBindings[0]?.logicalKey,
    );
    expect(immutable.authority.sourceClosure.modules[0]?.path).toBe(
      release.authority.sourceClosure.modules[0]?.path,
    );
    expect(Reflect.set(immutable.runner, "module", "attacker/runner")).toBe(
      false,
    );
    expect(() =>
      Reflect.apply(Array.prototype.push, immutable.events, [event]),
    ).toThrow();
  });

  it("rejects duplicate logical capability and subworkflow bindings", () => {
    const release = workflow(1, 1, "draft");
    expect(() =>
      defineWorkflowRelease({
        ...release,
        capabilityBindings: [
          ...release.capabilityBindings,
          {
            logicalKey: requiredFixtureValue(release.capabilityBindings[0])
              .logicalKey,
            version: 2,
            releaseChecksum: capability(2, "published").releaseChecksum,
          },
        ],
      }),
    ).toThrow(/duplicate workflow capability binding/i);
    expect(() =>
      defineWorkflowRelease({
        ...release,
        subworkflowBindings: [
          {
            workflowId: "workflow.fixture.child",
            version: 1,
            releaseChecksum: sha("1"),
          },
          {
            workflowId: "workflow.fixture.child",
            version: 2,
            releaseChecksum: sha("2"),
          },
        ],
      }),
    ).toThrow(/duplicate workflow subworkflow binding/i);
  });

  it("rejects forged graph, dependency, closure, and release checksums", () => {
    const workflowRelease = workflow(1, 1, "draft");
    expect(() =>
      defineWorkflowRelease({ ...workflowRelease, graphHash: sha("9") }),
    ).toThrow(/workflow graph.*authoritative closure/i);
    expect(() =>
      defineWorkflowRelease({
        ...workflowRelease,
        sourceClosureChecksum: sha("9"),
      }),
    ).toThrow(/workflow source closure.*authoritative/i);
    expect(() =>
      defineWorkflowRelease({
        ...workflowRelease,
        releaseChecksum: sha("9"),
      }),
    ).toThrow(/workflow release checksum.*generated descriptor/i);

    const capabilityRelease = capability(1, "draft");
    expect(() =>
      defineCapabilityRelease({
        ...capabilityRelease,
        dependencyManifest: capabilityRelease.dependencyManifest.map(
          (dependency) => ({ ...dependency, checksum: sha("9") }),
        ),
      }),
    ).toThrow(/dependency.*absent from authoritative closure/i);
    expect(() =>
      defineCapabilityRelease({
        ...capabilityRelease,
        sourceClosureChecksum: sha("9"),
      }),
    ).toThrow(/capability source closure.*authoritative/i);
  });

  it("revalidates forged releases on add and draft replacement", () => {
    const empty = definePublicationRegistry({
      capabilities: [],
      workflows: [],
    });
    expect(() =>
      addCapabilityRelease(empty, {
        ...capability(1, "draft"),
        releaseChecksum: sha("9"),
      }),
    ).toThrow(/capability release checksum.*generated descriptor/i);

    const draft = workflow(1, 1, "draft");
    const registry = definePublicationRegistry({
      capabilities: [capability(1, "published")],
      workflows: [draft],
    });
    expect(() =>
      addWorkflowRelease(registry, {
        ...draft,
        graphHash: sha("9"),
      }),
    ).toThrow(/workflow graph.*authoritative closure/i);
  });
});
