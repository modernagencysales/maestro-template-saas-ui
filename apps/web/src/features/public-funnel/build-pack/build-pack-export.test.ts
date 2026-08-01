import { describe, expect, it, vi } from "vitest";

import { compileFakeBuildPack } from "./build-pack-generator";
import {
  buildPackSectionIds,
  downloadBuildPack,
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

  it("downloads the canonical Build Pack Markdown", () => {
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ href: "", download: "", click }),
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:pack",
      revokeObjectURL,
    });
    try {
      downloadBuildPack(
        "pack_1",
        compileFakeBuildPack(makeEvaluation(fixtureCompleteAnswers)),
      );
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:pack");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
