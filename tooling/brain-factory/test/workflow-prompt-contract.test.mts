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

  it("binds cross-tranche integration to one immutable selection and full gate", () => {
    const wave = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../.fabro/workflows/brain-integrate-wave/workflow.fabro",
      ),
      "utf8",
    );
    expect(wave).toContain("never use a repository-wide glob");
    expect(wave).toContain("Never discover or add a late lane");
    expect(wave).toContain("same-wave edges");
    expect(wave).toContain("integration-wave-selection-check.mts");
    expect(wave.match(/host-test-slot --class full pnpm verify/g)).toHaveLength(
      2,
    );
    expect(wave).toContain("--wave-selection");
  });
});
