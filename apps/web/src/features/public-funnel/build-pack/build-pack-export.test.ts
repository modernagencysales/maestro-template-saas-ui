import { describe, expect, it } from "vitest";

import { compileFakeBuildPack } from "./build-pack-generator";
import {
  buildPackSectionIds,
  exportBuildPackMarkdown,
} from "./build-pack-export";
import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import { buildPackViewSectionIds } from "./build-pack-view";

describe("Complete Build Pack exports", () => {
  it("exports the same canonical sections as the web viewer", () => {
    expect(buildPackSectionIds).toEqual(buildPackViewSectionIds);
  });

  it("creates a portable handoff without making another model call", () => {
    const markdown = exportBuildPackMarkdown(
      "pack_1",
      compileFakeBuildPack(makeEvaluation(fixtureCompleteAnswers)),
    );
    expect(markdown).toContain("# Complete Build Pack");
    expect(markdown).toContain("## Requirements");
    expect(markdown).toContain("ChairFill");
    expect(markdown).toContain("Pack ID: pack_1");
  });
});
