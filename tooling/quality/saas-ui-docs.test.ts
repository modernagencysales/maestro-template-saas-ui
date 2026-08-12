import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Saas UI documentation contract", () => {
  it("teaches one upstream-derived frontend path and review evidence", () => {
    const agents = read("AGENTS.md");
    const pr = read(".github/pull_request_template.md");
    expect(agents).toContain("docs/template/saas-ui-frontend-authority.md");
    expect(pr).toContain("Upstream source file or Pro block");
    expect(pr).toContain("Deviation ledger entry");
    expect(pr).toContain("Desktop/mobile light/dark evidence");
  });

  it("keeps update and owner approval instructions discoverable", () => {
    expect(read("docs/template/saas-ui-upstream-update.md")).toContain(
      "Regenerate the Pro catalog",
    );
    expect(read("docs/template/saas-ui-golden-review.md")).toContain(
      "Approved: pinned reference and generated target",
    );
    expect(read("docs/licenses/saas-ui/starter-NOTICE.md")).toContain(
      "This license is a legal agreement between you",
    );
    expect(read("docs/licenses/saas-ui/pro-NOTICE.md")).toContain(
      "This license is a legal agreement between you",
    );
  });
});
