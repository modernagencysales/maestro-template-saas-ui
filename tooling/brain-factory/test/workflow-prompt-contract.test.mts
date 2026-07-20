import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  verifyWaveRunInspection,
  waveWorkflowArgs,
  type WaveRunIdentity,
} from "../src/integration-wave-launch.js";

const workflows = {
  "brain-build-task": {
    evidencePath: "/lane-results/",
    promptNodes: [
      "implement",
      "review_contract",
      "review_safety",
      "review_quality",
    ],
  },
  "brain-integrate-tranche": {
    evidencePath: "/integration/",
    promptNodes: ["integrate", "review", "repair", "record"],
  },
  "brain-integrate-wave": {
    evidencePath: "/integration/",
    promptNodes: ["review", "repair", "record"],
  },
  "brain-release-evidence": {
    evidencePath: "/release/release-result.json",
    promptNodes: ["operate", "review"],
  },
  "brain-repair-check": {
    evidencePath: "/lane-results/",
    promptNodes: ["repair", "review"],
  },
  "brain-repair-tranche": {
    evidencePath: "/integration/",
    promptNodes: ["repair", "review", "record"],
  },
} as const;

describe("Fabro workflow prompt contracts", () => {
  it("binds new wave launches to the two unambiguous v3 hashes", () => {
    const identity = {
      attempt: 2,
      baseSha: "a".repeat(40),
      integrationId: "wave-000001",
      mode: "recover" as const,
      reservationToken: "fixture",
      runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      selectionFileSha256: "b".repeat(64),
      selectionPath: "/tmp/wave-selection.json",
      selectionPayloadSha256: "c".repeat(64),
      workdir: "/tmp/wave-workdir",
    } satisfies WaveRunIdentity & { readonly runId: string };
    const args = waveWorkflowArgs({
      ...identity,
      controlRoot: "/tmp/control",
      evidenceDirectory: "/tmp/evidence",
      workflow: "/tmp/workflow.fabro",
    });
    expect(args).toContain("integration-mode=wave-v3");
    expect(args).toContain(
      `selection_payload_sha256=${identity.selectionPayloadSha256}`,
    );
    expect(args).toContain(
      `selection_file_sha256=${identity.selectionFileSha256}`,
    );
    expect(args.some((arg) => arg.startsWith("selection_sha256="))).toBe(false);

    const inspection = {
      run_id: identity.runId,
      run_spec: {
        settings: {
          run: {
            inputs: {
              attempt: identity.attempt,
              base_sha: identity.baseSha,
              integration_id: identity.integrationId,
              mode: identity.mode,
              reservation_token: identity.reservationToken,
              selection_file_sha256: identity.selectionFileSha256,
              selection_path: identity.selectionPath,
              selection_payload_sha256: identity.selectionPayloadSha256,
              workdir: identity.workdir,
            },
            metadata: {
              attempt: identity.attempt,
              integration: identity.integrationId,
              "integration-mode": "wave-v3",
              reservation: identity.reservationToken,
            },
          },
        },
      },
    };
    expect(() => verifyWaveRunInspection(inspection, identity)).not.toThrow();
    expect(() =>
      verifyWaveRunInspection(
        {
          ...inspection,
          run_spec: {
            settings: {
              run: {
                ...inspection.run_spec.settings.run,
                inputs: {
                  ...inspection.run_spec.settings.run.inputs,
                  selection_sha256: identity.selectionPayloadSha256,
                },
              },
            },
          },
        },
        identity,
      ),
    ).toThrow("legacy selection_sha256");
    expect(() =>
      waveWorkflowArgs({
        ...identity,
        controlRoot: "/tmp/control",
        evidenceDirectory: "/tmp/evidence",
        selectionSha256: identity.selectionPayloadSha256,
        workflow: "/tmp/workflow.fabro",
      } as Parameters<typeof waveWorkflowArgs>[0]),
    ).toThrow("ambiguous selection hash");
    expect(() =>
      verifyWaveRunInspection(inspection, {
        ...identity,
        selectionFileSha256: identity.selectionPayloadSha256,
        selectionPayloadSha256: identity.selectionFileSha256,
      }),
    ).toThrow("identity mismatch");
  });

  it("requires amended task artifacts before lane green", () => {
    const laneGates = readFileSync(
      resolve(import.meta.dirname, "../src/lane-gates.mts"),
      "utf8",
    );
    for (const file of [
      "apps/web/src/sample/templateData.test.ts",
      "docs/superpowers/receipts/maestro-brain/file-inventories/S02-T02-confect-generated-files.json",
      "packages/convex/confect/brain/pageTree.ts",
      "packages/convex/test/brain-pages-crud.test.ts",
      "apps/web/src/features/clients/clients-adapter.test.ts",
      "apps/web/src/features/clients/clients-adapter.ts",
      "apps/web/src/features/clients/clients-state.test.ts",
      "apps/web/src/features/clients/clients-state.ts",
      "apps/web/src/features/clients/clients-table.test.tsx",
      "apps/web/src/features/clients/clients-table.tsx",
      "apps/web/src/features/clients/create-client-dialog.test.tsx",
      "apps/web/src/features/clients/create-client-dialog.tsx",
      "packages/convex/confect/brain/clientBrief.ts",
      "packages/convex/confect/headless/apiKeys.impl.ts",
      "packages/convex/confect/headless/apiKeys.spec.ts",
      "packages/convex/confect/headless/authorizeOperation.ts",
      "packages/convex/confect/headless/principal.ts",
      "packages/convex/test/http-request-security.test.ts",
    ]) {
      expect(laneGates).toContain(file);
    }
  });

  it("keeps file discovery scoped in every agent prompt", () => {
    for (const [workflow, contract] of Object.entries(workflows)) {
      const path = resolve(
        import.meta.dirname,
        "../../../.fabro/workflows",
        workflow,
        "workflow.fabro",
      );
      const lines = readFileSync(path, "utf8").split("\n");
      const promptLines = lines.filter((line) => line.includes('prompt="'));
      expect(promptLines, `${workflow} prompt inventory`).toHaveLength(
        contract.promptNodes.length,
      );

      for (const node of contract.promptNodes) {
        const prompt = [...lines]
          .reverse()
          .find((line) => line.trimStart().startsWith(`${node} [`));
        expect(prompt, `${workflow}.${node} prompt`).toBeDefined();
        expect(prompt).toContain('prompt="');
        expect(prompt).toContain("scoped rtk rg --files <target-path>");
        expect(prompt).toContain("never use a repository-wide glob");
        expect(prompt).toContain("repos/<library>/<subpath>");
        expect(prompt).toContain(
          "Never search the home directory, a repository parent",
        );
        expect(prompt).toContain(
          "{{ inputs.evidence_dir|default('__required_evidence__') }}",
        );
        expect(prompt).toContain(contract.evidencePath);
        for (const forbidden of [
          "/Users/",
          "$HOME",
          "~/",
          "**/",
          "glob path=",
        ]) {
          expect(
            prompt,
            `${workflow}.${node} forbidden discovery`,
          ).not.toContain(forbidden);
        }
      }

      const preflight = lines.find((line) =>
        line.trimStart().startsWith("preflight ["),
      );
      expect(preflight).toContain(
        workflow === "brain-build-task"
          ? "$BRAIN_EVIDENCE_DIR"
          : "{{ inputs.evidence_dir|default('__required_evidence__') }}",
      );
      expect(preflight).toMatch(
        workflow === "brain-build-task"
          ? /\$\{BRAIN_EVIDENCE_DIR#\/\}/
          : /\$\{(?:E|EVIDENCE)#\/\}/,
      );
    }
  });

  it("keeps repair review and release verdicts behind deterministic gates", () => {
    const repair = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-repair-check/workflow.fabro",
      ),
      "utf8",
    );
    expect(repair).toContain("repair -> pre_review_gate");
    expect(repair).toContain("pre_review_gate -> review");
    expect(repair).toContain("review -> complete");
    expect(repair).toContain("complete -> final_gate");
    expect(repair).toContain(
      "Validate behavior only through the proof packet's exact focusedCommands",
    );
    expect(repair).toContain(
      "do not run raw generated-dependent package tests outside the task's transient codegen command",
    );
    expect(repair).toContain(
      "Do not use native apply_patch; update that proof with one guarded targeted shell or write_file operation",
    );
    expect(repair).toContain(
      "When that receipt is passed and bound to the exact current head, tree, and command set",
    );
    expect(repair).toContain(
      "do not invoke brain:factory:lane-gates and do not rerun its focused commands",
    );
    expect(repair).toContain(
      "Rerun a focused command only when the receipt or its evidence is inconsistent",
    );
    expect(repair).toContain('final_gate -> repair [label="red or rework"]');
    expect(repair).toContain("--stage final --reuse-pre-review");
    expect(repair).toContain(
      "After the first apply_patch expects raw patch text failure",
    );
    expect(repair).toContain("set reviewVerdict='pending'");
    expect(repair).toContain(
      "preserve focusedCommands exactly as declared by the existing proof and task contract",
    );
    expect(repair).toContain("Do not invoke brain:factory:lane-gates yourself");
    expect(repair).toContain(
      "the next deterministic pre_review_gate node owns the complete focused gate",
    );
    expect(repair).toContain(
      "factory's exact gate-counted hand-authored source-line calculation",
    );
    expect(repair).toContain("never copy a stale pre-amend count");

    const release = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-release-evidence/workflow.fabro",
      ),
      "utf8",
    );
    expect(release).toContain("review -> final_gate");
    expect(release).toContain("release-evidence-check.mts");
    expect(release).toContain("Do not fabricate live credentials");
  });

  it("serializes isolated exhaustive review lenses and joins them deterministically", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    expect(buildTask).toContain("gates -> review_snapshot");
    const reviewFork = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("review_fork ["));
    expect(reviewFork).toBe(
      '  review_fork [label="Serialized Isolated Review", shape=component, join_policy="wait_all", max_parallel=1]',
    );
    expect(reviewFork).not.toContain("max_parallel=3");
    expect(buildTask).toContain(
      'review_merge [label="Join Exhaustive Reviews", shape=tripleoctagon]',
    );
    expect(buildTask).toContain("review_snapshot -> review_fork");
    for (const lens of ["contract", "safety", "quality"] as const) {
      const node = `review_${lens}`;
      const definitions = buildTask
        .split("\n")
        .filter((line) => line.trimStart().startsWith(`${node} [`));
      expect(definitions).toHaveLength(1);
      const prompt = definitions[0];
      expect(buildTask).toContain(`review_fork -> ${node}`);
      expect(buildTask).toContain(`${node} -> review_merge`);
      expect(prompt).toContain(`.brain-review-output/${lens}.json`);
      expect(prompt).toContain(`review-lens-guard.mts\\" --lens ${lens}`);
      expect(prompt).toContain("every rubric item");
      expect(prompt).toContain("Never edit the proof packet");
      expect(prompt).toContain("Never edit or commit product/worktree files");
      expect(prompt).toContain("Shared evidence is read-only");
      expect(prompt).toContain("writes nothing to shared evidence");
      expect(prompt).toContain("factory-owned");
      expect(prompt).toContain("$BRAIN_REVIEW_ATTEMPT");
      expect(prompt).not.toContain("promote shared evidence");
    }
    expect(buildTask).toContain("review_merge -> review_aggregate");
    expect(buildTask).toContain("review-aggregate.mts");
    expect(buildTask).toContain('--attempt \\"$BRAIN_REVIEW_ATTEMPT\\"');
    expect(buildTask).toContain('--review-repo \\"$BRAIN_WORKDIR\\"');
    expect(buildTask).toContain("review_aggregate -> aggregate_gate");
    expect(buildTask).toContain(
      'aggregate_gate -> final_gates [condition="outcome=succeeded"]',
    );
    expect(buildTask).toContain('aggregate_gate -> implement [label="rework"]');
    expect(buildTask).toContain("final_gates -> complete");
    expect(buildTask).toContain("complete -> exit");
    expect(buildTask).not.toContain("complete -> final_gates");
    expect(
      buildTask.indexOf("review_aggregate -> aggregate_gate"),
    ).toBeLessThan(buildTask.indexOf("aggregate_gate -> final_gates"));
    expect(buildTask).toContain('review-worktree-guard.mts\\" capture');
  });

  it("runs review orchestration from current control tooling", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const node = (name: string) =>
      buildTask
        .split("\n")
        .find((line) => line.trimStart().startsWith(`${name} [`));
    const reviewSnapshot = node("review_snapshot");
    const reviewAggregate = node("review_aggregate");
    const controlLoader =
      "$BRAIN_CONTROL_ROOT/node_modules/tsx/dist/loader.mjs";

    expect(
      reviewSnapshot?.match(/node_modules\/tsx\/dist\/loader\.mjs/g) ?? [],
    ).toHaveLength(2);
    expect(reviewSnapshot).toContain(controlLoader);
    expect(reviewSnapshot).not.toContain("--import tsx");
    expect(reviewSnapshot).toContain(
      "$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/review-worktree-guard.mts",
    );
    expect(reviewSnapshot).toContain(
      "$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/review-worktrees.mts",
    );
    expect(reviewSnapshot).toContain('--workdir \\"$BRAIN_WORKDIR\\"');

    for (const lens of ["contract", "safety", "quality"] as const) {
      const reviewLens = node(`review_${lens}`);
      expect(
        reviewLens?.match(/node_modules\/tsx\/dist\/loader\.mjs/g) ?? [],
      ).toHaveLength(2);
      expect(reviewLens).toContain(controlLoader);
      expect(reviewLens).not.toContain("--import tsx");
      expect(reviewLens).toContain(
        "$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/review-worktrees.mts",
      );
      expect(reviewLens).toContain(
        "$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/review-lens-guard.mts",
      );
      expect(reviewLens).toContain('--workdir \\"$BRAIN_WORKDIR\\"');
      expect(reviewLens).toContain('cd \\"$REVIEW_WORKTREE\\"');
    }

    expect(
      reviewAggregate?.match(/node_modules\/tsx\/dist\/loader\.mjs/g) ?? [],
    ).toHaveLength(1);
    expect(reviewAggregate).toContain(controlLoader);
    expect(reviewAggregate).not.toContain("--import tsx");
    expect(reviewAggregate).toContain(
      "$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/review-aggregate.mts",
    );
    expect(reviewAggregate).toContain('--workdir \\"$BRAIN_WORKDIR\\"');
    expect(reviewAggregate).toContain('--review-repo \\"$BRAIN_WORKDIR\\"');
    expect(buildTask).not.toMatch(
      /(?:tsx tooling\/brain-factory\/src|\$BRAIN_WORKDIR\/tooling\/brain-factory\/src)\/review-(?:worktree-guard|worktrees|lens-guard|aggregate)\.mts/,
    );
  });

  it("keeps all command coordinates in validated environment argv", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    for (const line of buildTask
      .split("\n")
      .filter((line) => line.includes('script="'))) {
      expect(line).not.toContain("{{ inputs.");
    }
    const slash = "\\";
    for (const name of ["WORKDIR", "EVIDENCE_DIR", "TASK_ID"]) {
      expect(buildTask).toContain(`${slash}"$BRAIN_${name}${slash}"`);
    }
    const configWriter = readFileSync(
      resolve(import.meta.dirname, "../src/build-task-run-config.ts"),
      "utf8",
    );
    expect(configWriter).toContain("[environments.local.env]");
    expect(configWriter).toContain("JSON.stringify(value)");
  });

  it("applies archived resume commits inside the owning Fabro lane", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    expect(buildTask).toContain("resume_mode");
    expect(buildTask).toContain("resume_source_head");
    expect(buildTask).toContain("resume_task_base");
    expect(buildTask).toContain("resume_commits");
    expect(buildTask).toContain("preflight -> apply_archive");
    expect(buildTask).toContain("apply_archive -> implement");
    expect(buildTask).toContain('rtk proxy git cherry-pick \\"$@\\"');
    expect(buildTask).not.toContain('rtk proxy git cherry-pick \\"$COMMIT\\"');
    expect(
      buildTask.indexOf(
        'rtk proxy git cat-file -e \\"$COMMIT^{commit}\\"; done',
      ),
    ).toBeLessThan(buildTask.indexOf('rtk proxy git cherry-pick \\"$@\\"'));
    expect(buildTask).toContain(
      "If an archived resume cherry-pick is in progress",
    );
    expect(buildTask).toContain(
      "run rtk proxy git cherry-pick --continue until the pinned sequence is complete",
    );
    expect(buildTask).toContain(
      "if resolution requires an out-of-scope file, stop and report a contract gap",
    );
    expect(buildTask).toContain("preserved-worktree");
    expect(buildTask).toContain("preserved-conflict-aware");
    expect(buildTask).toContain("validate-preserved-resume.mts");
    expect(buildTask).toContain(
      '\\"$BRAIN_CONTROL_ROOT/tooling/brain-factory/src/validate-preserved-resume.mts\\"',
    );
    expect(buildTask).toContain(
      'if [ \\"$BRAIN_RESUME_MODE\\" = preserved-worktree ]',
    );
    expect(buildTask).toContain(
      'if [ \\"$BRAIN_RESUME_MODE\\" = preserved-conflict-aware ]',
    );
    expect(buildTask.indexOf("preflight -> apply_archive")).toBeLessThan(
      buildTask.indexOf("apply_archive -> implement"),
    );
  });

  it("salvages only the pinned dirty S04-T02 repair through Fabro", () => {
    const salvage = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-salvage-s04-t02/workflow.fabro",
      ),
      "utf8",
    );
    expect(salvage).toContain("expected_head");
    expect(salvage).toContain("allowed_dirty_files");
    expect(salvage).toContain('rtk proxy test \\"$ACTUAL\\" = \\"$ALLOWED\\"');
    expect(salvage).toContain("sourceSliceLimit !== 5");
    expect(salvage).toContain("exactly five coherent intention commits");
    expect(salvage).toContain("Never use --allow-empty");
    expect(salvage).toContain("slack-directory");
    expect(salvage).toContain("packages/convex typecheck");
    expect(salvage).toContain('rtk proxy test -z \\"$STATUS\\"');
    expect(salvage).toContain("reviewVerdict !== 'pending'");
    expect(salvage).toContain("Never use git add .");
  });

  it("uses RTK pass-through commands for guards, scripts, and proof data", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const implement = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("implement ["));
    const reviews = ["review_contract", "review_safety", "review_quality"].map(
      (node) =>
        buildTask
          .split("\n")
          .find((line) => line.trimStart().startsWith(`${node} [`)),
    );

    expect(implement).toContain("use rtk proxy test for shell guards");
    expect(implement).toContain("never rtk test");
    expect(implement).toContain("Never invoke rtk python");
    expect(implement).toContain("native write_file tool");
    expect(implement).toContain("rtk proxy python3");
    for (const prompt of [implement, ...reviews]) {
      expect(prompt).toContain("machine-parsed for the proof packet");
      expect(prompt).toContain("use rtk proxy git");
      expect(prompt).toContain("must never feed structured evidence");
    }
  });

  it("reviews integration-owned generated output at the lane boundary", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const prompts = ["review_contract", "review_safety", "review_quality"].map(
      (node) =>
        buildTask
          .split("\n")
          .find((line) => line.trimStart().startsWith(`${node} [`)),
    );
    const contract = prompts[0];
    const quality = prompts[2];

    for (const prompt of prompts) {
      expect(prompt).toContain(
        "Because aggregate admission requires zero findings, record only defects that require task rework",
      );
      expect(prompt).toContain(
        "Do not emit optional nits or observations as findings",
      );
    }
    for (const prompt of [contract, quality]) {
      expect(prompt).toContain(
        "Generated Confect and Convex output is integration-owned by Appendices O/P",
      );
      expect(prompt).toContain(
        "absence from the checked-in generated tree is expected lane state, not a finding",
      );
      expect(prompt).toContain(
        "the exact-head pre-review gate proves transient codegen passed and the task diff does not edit generated paths",
      );
      expect(prompt).toContain(
        "integration review owns direct-ref cleanup after regeneration",
      );
    }
    expect(contract).toContain(
      "Review schema and ref registration in the transient snapshot",
    );
    expect(quality).toContain(
      "Review generated refs in the transient snapshot",
    );
  });

  it("keeps integration Git proof raw and patch fallback bounded", () => {
    for (const workflow of [
      "brain-integrate-tranche",
      "brain-integrate-wave",
      "brain-repair-tranche",
    ] as const) {
      const source = readFileSync(
        resolve(
          import.meta.dirname,
          "../../../.fabro/workflows",
          workflow,
          "workflow.fabro",
        ),
        "utf8",
      );
      for (const node of workflows[workflow].promptNodes) {
        const prompt = source
          .split("\n")
          .find((line) => line.trimStart().startsWith(`${node} [`));
        expect(prompt, `${workflow}.${node}`).toContain(
          "use rtk proxy git for every SHA, path, status, numstat, or cherry value used as structured evidence",
        );
        expect(prompt, `${workflow}.${node}`).toContain(
          "filtered rtk git output must never feed structured evidence",
        );
        expect(prompt, `${workflow}.${node}`).toContain(
          "Do not use native apply_patch",
        );
      }
      expect(source).not.toMatch(/\$\([^\n)]*rtk git rev-parse/);
    }
  });

  it("binds task history depth to the manifest slice limit", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const implement = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("implement ["));
    expect(implement).toContain(
      "sourceSliceLimit from the task manifest, defaulting to four",
    );
    expect(implement).toContain("honor an explicit expanded task limit");
    expect(implement).not.toContain("one to four real task commits");
    expect(implement).not.toContain("more than four real commits");
  });

  it("bounds task reconnaissance and leaves deterministic gates to the workflow", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const implement = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("implement ["));
    const reviews = ["review_contract", "review_safety", "review_quality"].map(
      (node) =>
        buildTask
          .split("\n")
          .find((line) => line.trimStart().startsWith(`${node} [`)),
    );

    expect(implement).toContain(
      "Contract reading is not reconnaissance and is never skipped",
    );
    expect(implement).toContain(
      "at most one scoped inventory pass per declared file-lock root",
    );
    expect(implement).toContain(
      "one exact-symbol or named-reference lookup per required seam",
    );
    expect(implement).toContain(
      "report a contract or template gap instead of widening the search",
    );
    expect(implement).toContain(
      "During implementation run only the smallest new or failing test needed to iterate",
    );
    expect(implement).toContain(
      "Do not invoke brain:factory:lane-gates yourself",
    );
    expect(implement).toContain(
      "the next deterministic workflow node owns the complete focused gate",
    );
    expect(implement).toContain(
      "On a repair or archived resume, preserve focusedCommands exactly as declared by the existing proof and task contract",
    );
    expect(implement).toContain(
      "record newly run lint, typecheck, coverage, or diagnostic commands only as supplemental command results",
    );
    expect(implement).toContain(
      "after any repair, if it exceeds the manifest sourceSliceLimit",
    );
    expect(implement).toContain("never create empty padding commits");
    expect(implement).toContain("or use --allow-empty");
    expect(implement).toContain(
      "factory's exact gate-counted source-line calculation",
    );
    for (const review of reviews) {
      expect(review).toContain(
        "exact passed pre-review lane-gate report for the same head and task contract",
      );
      expect(review).toContain(
        "Semantic inspection of the tests and diff remains mandatory",
      );
      expect(review).toContain("planSha256 is retained provenance");
      expect(review).toContain("any taskBlockHash drift is rework");
    }
  });

  it("binds lane-green results to the manifest tranche", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const complete = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("complete ["));
    const writer = readFileSync(
      resolve(import.meta.dirname, "../src/write-lane-result.mts"),
      "utf8",
    );

    expect(complete).toContain("write-lane-result.mts");
    expect(writer).toContain("buildManifest");
    expect(writer).toContain("tranche: task.tranche");
    expect(writer).toContain("validateContractReproofRequest");
    expect(writer).toContain("validateFinalLaneResult");
    expect(writer).toContain("atomicWrite");
    expect(buildTask).toContain(
      'aggregate_gate -> final_gates [condition="outcome=succeeded"]',
    );
    expect(buildTask).toContain("final_gates -> complete");
    expect(buildTask).toContain("complete -> exit");

    const laneGates = readFileSync(
      resolve(import.meta.dirname, "../src/lane-gates.mts"),
      "utf8",
    );
    expect(laneGates).not.toContain("validateFinalLaneResult");
    expect(laneGates).not.toContain("missing final lane result");
  });

  it("propagates the authorized host load ceiling to lane gates", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );

    expect(buildTask).toContain("host_test_max_load_1m");
    expect(buildTask).toContain(
      'export HOST_TEST_MAX_LOAD_1M=\\"$BRAIN_HOST_TEST_MAX_LOAD_1M\\"',
    );
    expect(buildTask.match(/export HOST_TEST_MAX_LOAD_1M=/g)).toHaveLength(2);
  });

  it("binds cross-tranche integration to one immutable selection and full gate", () => {
    const wave = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-integrate-wave/workflow.fabro",
      ),
      "utf8",
    );
    const review = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("review ["));
    const deterministicApply = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("apply_integration_wave ["));
    const reviewGate = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("review_gate ["));
    const repair = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("repair ["));
    const record = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("record ["));
    expect(wave).toContain("never use a repository-wide glob");
    expect(wave).not.toMatch(/^\s*integrate \[/m);
    expect(wave).not.toContain("#integrate");
    expect(wave).toContain("selection_payload_sha256");
    expect(wave).toContain("selection_file_sha256");
    expect(wave).not.toContain("selection_sha256");
    expect(wave).toContain("--selection-payload-sha256");
    expect(wave).toContain("--selection-file-sha256");
    expect(deterministicApply).toContain("apply-integration-wave.mts");
    expect(deterministicApply).toContain("max_retries=0");
    expect(deterministicApply).toContain('--mode \\"$MODE\\"');
    expect(wave).toContain("preflight -> apply_integration_wave");
    expect(wave).toContain("apply_integration_wave -> dependencies");
    expect(wave).toContain("same-wave edges");
    expect(review).toContain(
      "Preserve status ready_for_review through this review",
    );
    expect(review).toContain(
      "selected lane results must remain status lane_green until the record node",
    );
    expect(review).toContain(
      "Do not run integration-result-check.mts or validateIntegratedLanes before record",
    );
    expect(review).toContain(
      "superseded integration overlay metadata is provenance, not a blocker",
    );
    expect(review).toContain("reviewed is not a valid status");
    expect(review).toContain(
      "Preserve schemaVersion maestro-brain-integration-result/v3 and every integration-produced field",
    );
    expect(review).toContain(
      "canonical budget evidence is each selected lane's exact-head final lane-gate sourceSlices",
    );
    expect(review).toContain(
      "do not recompute budgets from integration cherry-pick commit numstat",
    );
    expect(review).toContain(
      "Ignore every prior broad-gate receipt status and finding during semantic review",
    );
    expect(review).toContain(
      "The deterministic gates node exclusively owns broad-gate execution and its verdict",
    );
    expect(reviewGate).toContain('.status == \\"ready_for_review\\"');
    expect(wave).toContain("integration-wave-selection-check.mts");
    expect(wave).toContain("hydrate-integration-dependencies.mts");
    expect(wave).toContain("repair -> dependencies");
    expect(repair).toContain("max_visits=2");
    expect(repair).toContain("Never edit hand-authored product code or tests");
    expect(repair).toContain("exactly one repair attempt");
    expect(wave).toContain(
      'dependencies -> review [condition="outcome=succeeded"]',
    );
    expect(wave).toContain("review -> review_gate");
    expect(wave.indexOf("review -> review_gate")).toBeLessThan(
      wave.indexOf("gates -> record"),
    );
    expect(wave.indexOf("gates -> record")).toBeLessThan(
      wave.indexOf("record -> post_record"),
    );
    expect(wave).not.toContain("host-test-slot --class full pnpm verify");
    expect(wave).toContain("integration-broad-gate.mts");
    expect(wave).toContain("broad-gate-HEAD.json sidecar");
    const broadGateRunner = readFileSync(
      resolve(import.meta.dirname, "../src/integration-broad-gate.ts"),
      "utf8",
    );
    expect(broadGateRunner).toContain(
      '"rtk host-test-slot --class full pnpm verify"',
    );
    expect(wave).toContain("--wave-selection");
    expect(record).toContain("integrationWorkdir exactly");
    expect(record).toContain(
      "The required field name is integrationWorkdir, not workdir",
    );
    expect(record).toContain("Do not use native apply_patch");
  });

  it("keeps positive acceptance evidence out of unaccepted lane records", () => {
    for (const workflow of [
      "brain-integrate-tranche",
      "brain-integrate-wave",
      "brain-repair-tranche",
    ]) {
      const source = readFileSync(
        resolve(
          import.meta.dirname,
          "../../../.fabro/workflows",
          workflow,
          "workflow.fabro",
        ),
        "utf8",
      );
      const record = source
        .split("\n")
        .find((line) => line.trimStart().startsWith("record ["));
      expect(record, `${workflow}.record prompt`).toContain(
        "Remove acceptedBecause whenever accepted:false",
      );
      expect(record, `${workflow}.record prompt`).toContain(
        "acceptedBecause may exist only with accepted:true and status accepted",
      );
    }
  });

  it("records integrated wave lanes before acceptance", () => {
    const wave = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-integrate-wave/workflow.fabro",
      ),
      "utf8",
    );
    const record = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("record ["));

    expect(record).toContain(
      "set lane status integrated whenever accepted:false",
    );
    expect(record).toContain(
      "Set lane status accepted only when original acceptanceAfter evidence proves accepted:true",
    );
  });

  it("serializes legacy and wave integration through one global lock", () => {
    for (const file of [
      "integrate.mts",
      "integrate-wave.mts",
      "promote-integration-wave.mts",
      "recover-integration.mts",
      "recover-integration-wave.mts",
    ]) {
      expect(
        readFileSync(resolve(import.meta.dirname, "../src", file), "utf8"),
      ).toContain("GLOBAL_INTEGRATION_LOCK");
    }
  });

  it("uses unfiltered git output for wave changed-file identity", () => {
    const integrateWave = readFileSync(
      resolve(import.meta.dirname, "../src/integrate-wave.mts"),
      "utf8",
    );

    expect(integrateWave).toContain('["proxy", "git", "diff", "--name-only"');
  });
});
