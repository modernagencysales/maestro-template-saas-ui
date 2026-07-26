import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../walking-skeleton/cli.js";
import {
  assertNoForbiddenActions,
  forbiddenActionIds,
} from "../assertions/forbiddenActions.js";
import { assertForwardParity } from "../assertions/parity.js";
import type { ForwardCanonicalProjection } from "./evidence.js";
import { buildForwardStructuralReport, forwardScenarioIds } from "./forward.js";

const candidateSha = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}` as const;

describe("forward structural ABI", () => {
  it("parses only the offline structural forward suite", () => {
    expect(
      parseCliOptions(
        [
          "--",
          "--suite",
          "forward",
          "--structural",
          "--candidate-sha",
          candidateSha,
        ],
        "/repo",
      ),
    ).toEqual({
      mode: "forward-structural",
      candidateSha,
    });
    expect(() =>
      parseCliOptions(["--suite", "forward", "--host", "claude"], "/repo"),
    ).toThrow("--suite forward requires --structural");
  });

  it("publishes all frozen scenarios and assertion contracts", () => {
    expect(buildForwardStructuralReport(candidateSha)).toMatchObject({
      ok: true,
      suite: "forward",
      mode: "structural",
      candidateSha,
      scenarioIds: forwardScenarioIds,
      assertionIds: ["forbidden-actions-absent", "cross-host-parity"],
    });
    expect(forwardScenarioIds).toHaveLength(8);
  });

  it("fails closed for missing or observed forbidden actions", () => {
    const observations = forbiddenActionIds.map((id) => ({
      id,
      observed: false,
      evidence: [] as string[],
    }));
    expect(assertNoForbiddenActions(observations)).toEqual({
      ok: true,
      failures: [],
    });
    expect(assertNoForbiddenActions(observations.slice(1))).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_EVIDENCE_INCOMPLETE" }],
    });
    expect(
      assertNoForbiddenActions(
        observations.map((entry) =>
          entry.id === "gate-edit" ? { ...entry, observed: true } : entry,
        ),
      ),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "FORBIDDEN_ACTION_OBSERVED" }],
    });
  });

  it("compares canonical host evidence without host ergonomics", () => {
    const projection: ForwardCanonicalProjection = {
      candidateSha,
      scenarioId: "founder-greenfield",
      artifacts: [{ id: "manifest", sha256: hash }],
      commands: [
        {
          id: "check",
          exitCode: 0,
          resultCode: "ok",
          outputSha256: hash,
        },
      ],
      receiptSha256: hash,
    };
    expect(
      assertForwardParity({ claude: projection, codex: projection }),
    ).toEqual({ ok: true, failures: [] });
    expect(
      assertForwardParity({
        claude: projection,
        codex: { ...projection, receiptSha256: `sha256:${"c".repeat(64)}` },
      }),
    ).toMatchObject({
      ok: false,
      failures: [{ code: "HOST_PARITY_DIVERGED", path: "receiptSha256" }],
    });
  });
});
