import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

const approvedLicenseHashes = {
  starter: "3142608be993ef63d2dd8df2e788d1ca6f3af984f5071d584dfc4f0168fe54ae",
  pro: "67dcccb4e18b5193cf76f757a43648cbe5fdbc825ec8d5039e0def451283cd52",
} as const;

type Manifest = Readonly<{
  pins: Readonly<{ starter: string; pro: string }>;
  licenses: readonly Readonly<{
    source: keyof typeof approvedLicenseHashes;
    path: string;
    destination: string;
  }>[];
}>;

describe("Saas UI upstream license provenance", () => {
  it("preserves the exact notices for the pinned paid sources", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, "docs/template/saas-ui-upstream.json"),
        "utf8",
      ),
    ) as Manifest;

    expect(manifest.pins.starter).toBe(
      "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
    );
    expect(manifest.pins.pro).toBe("ac3a40c8dc05e403f9d501a87c092646891d3c40");
    expect(manifest.licenses).toEqual([
      {
        source: "starter",
        path: "LICENSE",
        destination: "docs/licenses/saas-ui/starter-NOTICE.md",
      },
      {
        source: "pro",
        path: "LICENSE",
        destination: "docs/licenses/saas-ui/pro-NOTICE.md",
      },
    ]);

    for (const license of manifest.licenses) {
      const content = readFileSync(resolve(root, license.destination));
      expect(content.byteLength).toBeGreaterThan(0);
      expect(createHash("sha256").update(content).digest("hex")).toBe(
        approvedLicenseHashes[license.source],
      );
    }
  });
});
