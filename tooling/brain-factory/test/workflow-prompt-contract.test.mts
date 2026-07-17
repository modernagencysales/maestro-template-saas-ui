import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflows = {
  "brain-build-task": {
    evidencePath: "/lane-results/",
    promptNodes: ["implement", "review"],
  },
  "brain-integrate-tranche": {
    evidencePath: "/integration/",
    promptNodes: ["integrate", "review", "repair", "record"],
  },
  "brain-integrate-wave": {
    evidencePath: "/integration/",
    promptNodes: ["integrate", "review", "repair", "record"],
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
        const prompt = lines.find((line) =>
          line.trimStart().startsWith(`${node} [`),
        );
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
        "{{ inputs.evidence_dir|default('__required_evidence__') }}",
      );
      expect(preflight).toMatch(/\$\{(?:E|EVIDENCE)#\/\}/);
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

  it("keeps task review writes proof-only and avoids malformed patch retries", () => {
    const buildTask = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-build-task/workflow.fabro",
      ),
      "utf8",
    );
    const review = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("review ["));
    expect(review).toContain(
      "The only allowed write is that exact proof packet",
    );
    expect(review).toContain("Do not use native apply_patch");
    expect(review).toContain("one guarded targeted shell write");
    expect(buildTask).toContain("gates -> review_snapshot");
    expect(buildTask).toContain("review_snapshot -> review");
    expect(buildTask).toContain("review -> review_immutability");
    expect(buildTask).toContain("review_immutability -> review_gate");
    expect(buildTask).toContain("review-worktree-guard.mts capture");
    expect(buildTask).toContain("review-worktree-guard.mts verify");
    expect(buildTask).toContain(
      'review_gate -> review_snapshot [label="pending"]',
    );
    expect(buildTask).toContain(
      "independent review left a non-terminal verdict",
    );
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
    expect(buildTask.indexOf("preflight -> apply_archive")).toBeLessThan(
      buildTask.indexOf("apply_archive -> implement"),
    );
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
    const review = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("review ["));

    expect(implement).toContain("use rtk proxy test for shell guards");
    expect(implement).toContain("never rtk test");
    expect(implement).toContain("Never invoke rtk python");
    expect(implement).toContain("native write_file tool");
    expect(implement).toContain("rtk proxy python3");
    for (const prompt of [implement, review]) {
      expect(prompt).toContain("machine-parsed for the proof packet");
      expect(prompt).toContain("use rtk proxy git");
      expect(prompt).toContain("must never feed structured evidence");
    }
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
    const review = buildTask
      .split("\n")
      .find((line) => line.trimStart().startsWith("review ["));

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
    expect(review).toContain(
      "exact passed pre-review lane-gate report for the same head and task contract",
    );
    expect(review).toContain(
      "Rerun a focused command only when that report or its evidence is inconsistent",
    );
    expect(review).toContain(
      "semantic inspection of the tests and diff remains mandatory",
    );
    expect(review).toContain("planSha256 is retained provenance");
    expect(review).toContain(
      "an unrelated global plan change is not contract drift when this task's taskBlockHash is unchanged",
    );
    expect(review).toContain("any taskBlockHash drift is rework");
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
    expect(buildTask).toContain(
      'review_gate -> complete [condition="outcome=succeeded"]',
    );
    expect(buildTask).toContain("complete -> final_gates");
    expect(buildTask).toContain(
      'final_gates -> exit [condition="outcome=succeeded"]',
    );

    const laneGates = readFileSync(
      resolve(import.meta.dirname, "../src/lane-gates.mts"),
      "utf8",
    );
    expect(laneGates).toContain('if (stage === "final")');
    expect(laneGates).toContain("validateFinalLaneResult");
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
    const integrate = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("integrate ["));
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
    expect(wave).toContain("Never discover or add a late lane");
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
      "Preserve schemaVersion maestro-brain-integration-result/v2 and every integration-produced field",
    );
    expect(review).toContain(
      "canonical budget evidence is each selected lane's exact-head final lane-gate sourceSlices",
    );
    expect(review).toContain(
      "do not recompute budgets from integration cherry-pick commit numstat",
    );
    expect(reviewGate).toContain('.status == \\"ready_for_review\\"');
    expect(wave).toContain("integration-wave-selection-check.mts");
    expect(wave).toContain("hydrate-integration-dependencies.mts");
    expect(integrate).toContain(
      "Immediately after all selected source ranges are applied",
    );
    expect(integrate).toContain(
      "before any Confect, Convex, manifest, or route codegen or focused check",
    );
    expect(integrate).toContain(
      "Format every generated candidate changed by codegen before calculating net generatedFiles",
    );
    expect(integrate).toContain(
      "exec tsx src/hydrate-integration-dependencies.mts --workdir",
    );
    expect(integrate).toMatch(
      /all selected source ranges are applied.*hydrate-integration-dependencies\.mts.*Run centralized Confect/,
    );
    expect(wave).toContain("integrate -> dependencies");
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
