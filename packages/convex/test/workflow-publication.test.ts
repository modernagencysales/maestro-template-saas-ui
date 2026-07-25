import { describe, expect, it } from "vitest";

import {
  addCapabilityRelease,
  addWorkflowRelease,
  assertWorkflowStartBinding,
  checksumCapabilityRelease,
  checksumPublicationSource,
  checksumPublicationSourceClosure,
  checksumWorkflowRelease,
  defineCapabilityRelease,
  definePublicationRegistry,
  defineWorkflowRelease,
  publishCapability,
  publishWorkflow,
  resolveWorkflowCapabilityForRun,
  resolveWorkflowForRun,
  resolveWorkflowStart,
  retireWorkflow,
  type CapabilityRelease,
  type ChecksummedModule,
  type WorkflowRelease,
} from "../confect/workflows/_kit/publication";

const sha = (digit: string) => digit.repeat(64);

const sourceModule = (module: string, source: string): ChecksummedModule => ({
  module,
  source,
  checksum: checksumPublicationSource(source),
});

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
    functionRef: `capabilities/_versions/fixtureEcho/v${version}:run`,
    functionReference: `capabilities/_versions/fixtureEcho/v${version}:run`,
    argsSchema: `fixtureEcho.v${version}.args`,
    returnSchema: `fixtureEcho.v${version}.return`,
    effectManifest: { kind: "mutation", external: false },
    dependencyManifest,
    sourceClosureChecksum: checksumPublicationSourceClosure(dependencyManifest),
    releaseChecksum: "",
    semanticComplete: true,
    isolatedFixture: true,
  };
  return defineCapabilityRelease({
    ...candidate,
    releaseChecksum: checksumCapabilityRelease(candidate),
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
  const sourceManifest = [
    sourceModule(
      `workflows/fixturePublication/v${version}.graph.ts`,
      graphSource,
    ),
    interpreter,
  ];
  const candidate: WorkflowRelease<string, string> = {
    workflowId: "workflow.fixture.publication",
    version,
    lifecycle,
    graphSource,
    graphHash: checksumPublicationSource(graphSource),
    runner: {
      ref: `workflowRunners/fixturePublication/v${version}:run`,
      module: `workflowRunners/fixturePublication/v${version}`,
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
    sourceManifest,
    sourceClosureChecksum: checksumPublicationSourceClosure(sourceManifest),
    releaseChecksum: "",
    stableStepNames: ["start.v2", "fixture-echo.v2", "receipt.v2"],
    semanticComplete: true,
    isolatedFixture: true,
  };
  return defineWorkflowRelease({
    ...candidate,
    releaseChecksum: checksumWorkflowRelease(candidate),
  });
};

const resealWorkflow = <RunnerRef, CompletionRef>(
  release: WorkflowRelease<RunnerRef, CompletionRef>,
): WorkflowRelease<RunnerRef, CompletionRef> =>
  defineWorkflowRelease({
    ...release,
    releaseChecksum: checksumWorkflowRelease(release),
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
        releaseChecksum: release.releaseChecksum,
        kickoffProfile: "queued",
      }),
    ).toThrow(/graph hash/i);
  });

  it("clones and deeply freezes nested publication content", () => {
    const release = workflow(1, 1, "published");
    const runner = { ...release.runner };
    const event = { ...release.events[0]! };
    const capabilityBinding = { ...release.capabilityBindings[0]! };
    const source = { ...release.sourceManifest[0]! };
    const immutable = defineWorkflowRelease({
      ...release,
      runner,
      events: [event],
      capabilityBindings: [capabilityBinding],
      sourceManifest: [source, release.sourceManifest[1]!],
    });

    runner.module = "attacker/runner";
    event.validator = "attacker.validator";
    capabilityBinding.logicalKey = "capability.attacker";
    source.source = "attacker source";

    expect(immutable.runner.module).toBe(release.runner.module);
    expect(immutable.events[0]?.validator).toBe(release.events[0]?.validator);
    expect(immutable.capabilityBindings[0]?.logicalKey).toBe(
      release.capabilityBindings[0]?.logicalKey,
    );
    expect(immutable.sourceManifest[0]?.source).toBe(
      release.sourceManifest[0]?.source,
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
            logicalKey: release.capabilityBindings[0]!.logicalKey,
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
    ).toThrow(/workflow graph checksum/i);
    expect(() =>
      defineWorkflowRelease({
        ...workflowRelease,
        sourceClosureChecksum: sha("9"),
      }),
    ).toThrow(/workflow source closure checksum/i);
    expect(() =>
      defineWorkflowRelease({
        ...workflowRelease,
        releaseChecksum: sha("9"),
      }),
    ).toThrow(/workflow release checksum/i);

    const capabilityRelease = capability(1, "draft");
    expect(() =>
      defineCapabilityRelease({
        ...capabilityRelease,
        dependencyManifest: capabilityRelease.dependencyManifest.map(
          (dependency) => ({ ...dependency, checksum: sha("9") }),
        ),
      }),
    ).toThrow(/checksum does not match canonical content/i);
    expect(() =>
      defineCapabilityRelease({
        ...capabilityRelease,
        sourceClosureChecksum: sha("9"),
      }),
    ).toThrow(/capability source closure checksum/i);
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
    ).toThrow(/capability release checksum/i);

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
    ).toThrow(/workflow graph checksum/i);
  });
});
