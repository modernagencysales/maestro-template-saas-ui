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
    expect(repair).toContain("review -> final_gate");
    expect(repair).toContain('final_gate -> repair [label="red or rework"]');
    expect(repair).toContain("--stage final --reuse-pre-review");

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
    expect(buildTask).toContain("review -> review_gate");
    expect(buildTask).toContain('review_gate -> review [label="pending"]');
    expect(buildTask).toContain(
      "independent review left a non-terminal verdict",
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
    expect(implement).toContain("S04-T01 permits five");
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

    expect(complete).toContain("task-manifest.json");
    expect(complete).toContain("manifest tranche missing");
    expect(complete).toContain("tranche:task.tranche");
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
    const reviewGate = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("review_gate ["));
    const record = wave
      .split("\n")
      .find((line) => line.trimStart().startsWith("record ["));
    expect(wave).toContain("never use a repository-wide glob");
    expect(wave).toContain("Never discover or add a late lane");
    expect(wave).toContain("same-wave edges");
    expect(review).toContain(
      "Preserve status ready_for_review through this review",
    );
    expect(review).toContain("reviewed is not a valid status");
    expect(reviewGate).toContain('.status == \\"ready_for_review\\"');
    expect(wave).toContain("integration-wave-selection-check.mts");
    expect(wave).toContain("hydrate-integration-dependencies.mts");
    expect(wave).toContain("integrate -> dependencies");
    expect(wave).toContain("repair -> dependencies");
    expect(wave).toContain(
      'dependencies -> review [condition="outcome=succeeded"]',
    );
    expect(wave).toContain("review -> review_gate");
    expect(wave.match(/host-test-slot --class full pnpm verify/g)).toHaveLength(
      2,
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
