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
  resolveWorkflowCapabilityForRun,
  resolveWorkflowForRun,
  resolveWorkflowStart,
  retireWorkflow,
} from "../confect/workflows/_kit/publication";

const sha = (digit: string) => digit.repeat(64);

const capability = (version: number, lifecycle: "draft" | "published") =>
  defineCapabilityRelease({
    logicalKey: "capability.fixture.echo",
    version,
    lifecycle,
    functionRef: `capabilities/_versions/fixtureEcho/v${version}:run`,
    argsSchema: `fixtureEcho.v${version}.args`,
    returnSchema: `fixtureEcho.v${version}.return`,
    effectManifest: { kind: "mutation", external: false },
    dependencyManifest: [
      {
        module: `domain/fixtureEcho/v${version}`,
        checksum: sha(String(version)),
      },
    ],
    sourceClosureChecksum: sha(String(version + 1)),
    releaseChecksum: sha(String(version + 2)),
    semanticComplete: true,
    isolatedFixture: true,
  });

const workflow = (
  version: number,
  capabilityVersion: number,
  lifecycle: "draft" | "published",
) =>
  defineWorkflowRelease({
    workflowId: "workflow.fixture.publication",
    version,
    lifecycle,
    graphHash: sha(String(version)),
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
      version: 1,
    },
    kickoffProfiles: ["eager-first-poll", "queued"],
    capabilityBindings: [
      {
        logicalKey: "capability.fixture.echo",
        version: capabilityVersion,
        releaseChecksum: sha(String(capabilityVersion + 2)),
      },
    ],
    subworkflowBindings: [],
    runtimeVersion: "maestro-workflow-runtime.v2",
    interpreter: {
      module: "workflows/_kit/graphRunnerV2",
      checksum: sha("8"),
    },
    lifecycleContractVersion: 1,
    sourceClosureChecksum: sha(String(version + 4)),
    releaseChecksum: sha(String(version + 5)),
    stableStepNames: ["start.v2", "fixture-echo.v2", "receipt.v2"],
    semanticComplete: true,
    isolatedFixture: true,
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

    expect(resolveWorkflowStart(withDrafts, v1Workflow.workflowId, 1)).toBe(
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
    expect(resolveWorkflowStart(published, v1Workflow.workflowId, 1)).toBe(
      v1Workflow,
    );
  });

  it("rejects incomplete releases and published-version overwrite", () => {
    const incomplete = defineWorkflowRelease({
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
      addWorkflowRelease(
        published,
        defineWorkflowRelease({
          ...workflow(1, 1, "published"),
          graphHash: sha("9"),
        }),
      ),
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
    ).toBe(release);
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
});
