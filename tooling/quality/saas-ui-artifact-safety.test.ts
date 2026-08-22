import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { assertSaasUiArtifactSafety } from "./check-saas-ui-artifact-safety.mts";

const pins = {
  template: "acf0bc4be38dea842f321831387fc77cf7242439",
  starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
  pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
} as const;
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const createFixture = (
  options: {
    readonly destination?: string;
    readonly packagePatch?: Record<string, unknown>;
    readonly starterReceiptDestination?: string;
  } = {},
) => {
  const root = mkdtempSync(join(tmpdir(), "saas-ui-artifact-safety-"));
  const destination = options.destination ?? "src/paid.ts";
  mkdirSync(join(root, "docs/template"), { recursive: true });
  mkdirSync(dirname(join(root, destination)), { recursive: true });
  mkdirSync(join(root, "docs/licenses/saas-ui"), { recursive: true });
  writeFileSync(join(root, destination), "paid source\n");
  writeFileSync(
    join(root, "docs/licenses/saas-ui/starter-NOTICE.md"),
    "starter notice\n",
  );
  writeFileSync(
    join(root, "docs/licenses/saas-ui/pro-NOTICE.md"),
    "pro notice\n",
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "private-fixture",
      private: true,
      ...options.packagePatch,
    }),
  );
  writeFileSync(
    join(root, "docs/template/saas-ui-upstream.json"),
    JSON.stringify({
      schemaVersion: 1,
      pins,
      registry: {
        catalog: "apps/web/components.json",
        config: "apps/web/components.json",
        installRoot: "apps/web/src/components",
        sourceCommit: pins.pro,
      },
      compositions: [
        {
          id: "fixture",
          source: "starter/apps/web/src/fixture.tsx",
          factoryDestination: destination,
          generatedDestination: destination,
          files: [
            {
              source: "apps/web/src/fixture.tsx",
              destination,
            },
          ],
        },
      ],
      licenses: [
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
      ],
    }),
  );
  writeFileSync(
    join(root, "docs/template/saas-ui-registry-files.json"),
    JSON.stringify({
      schemaVersion: 1,
      sourceCommit: pins.pro,
      installed: [],
      files: [
        {
          source: "apps/web/src/fixture.tsx",
          destination,
          sha256: hash("paid source\n"),
          adapted: true,
        },
      ],
    }),
  );
  const receiptFiles = [
    {
      source: "apps/web/src/fixture.tsx",
      destination,
      sourceSha256: "1".repeat(64),
      sha256: hash("paid source\n"),
      adapted: false,
    },
    ...(options.starterReceiptDestination === undefined
      ? []
      : [
          {
            source: "apps/web/src/starter-paid.ts",
            destination: options.starterReceiptDestination,
            sourceSha256: "3".repeat(64),
            sha256: hash("starter paid source\n"),
            adapted: true,
          },
        ]),
  ];
  writeFileSync(
    join(root, "docs/template/saas-ui-starter-files.json"),
    JSON.stringify({
      schemaVersion: 1,
      sourceCommit: pins.starter,
      files: receiptFiles,
    }),
  );
  for (const file of receiptFiles) {
    mkdirSync(dirname(join(root, file.destination)), { recursive: true });
    if (file.destination !== destination)
      writeFileSync(join(root, file.destination), "starter paid source\n");
  }
  return root;
};

describe("Saas UI artifact safety", () => {
  it("allows paid source only in a private repository with preserved notices", () => {
    const root = createFixture();
    try {
      expect(assertSaasUiArtifactSafety(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects paid source owned by a non-private package", () => {
    const root = createFixture({
      destination: "packages/public-paid/src/index.ts",
    });
    try {
      mkdirSync(join(root, "packages/public-paid"), { recursive: true });
      writeFileSync(
        join(root, "packages/public-paid/package.json"),
        JSON.stringify({ name: "public-paid", version: "1.0.0" }),
      );
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "paid source package packages/public-paid/package.json must be private: packages/public-paid/src/index.ts",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects paid source included by npm files or a public artifact path", () => {
    const npmRoot = createFixture({
      packagePatch: {
        version: "1.0.0",
        files: ["src/paid.ts"],
      },
    });
    const publicRoot = createFixture({
      destination: "apps/web/dist/client/paid.ts",
    });
    try {
      expect(assertSaasUiArtifactSafety(npmRoot)).toContain(
        "paid source enters npm packlist: src/paid.ts",
      );
      expect(assertSaasUiArtifactSafety(publicRoot)).toContain(
        "paid source enters public artifact: apps/web/dist/client/paid.ts",
      );
    } finally {
      rmSync(npmRoot, { recursive: true, force: true });
      rmSync(publicRoot, { recursive: true, force: true });
    }
  });

  it("fails closed when a required starter receipt exposes paid source", () => {
    const root = createFixture({
      starterReceiptDestination: "src/starter-paid.ts",
      packagePatch: {
        version: "1.0.0",
        files: ["src/starter-paid.ts"],
      },
    });
    try {
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "paid source enters npm packlist: src/starter-paid.ts",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects starter source whose receipt hash no longer matches", () => {
    const root = createFixture();
    try {
      writeFileSync(join(root, "src/paid.ts"), "changed paid source\n");
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "starter receipt destination hash mismatch: src/paid.ts",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an adapted registry source whose receipt hash no longer matches", () => {
    const root = createFixture();
    try {
      writeFileSync(join(root, "src/paid.ts"), "changed paid source\n");
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "registry receipt destination hash mismatch: src/paid.ts",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing required starter receipt", () => {
    const root = createFixture();
    try {
      rmSync(join(root, "docs/template/saas-ui-starter-files.json"));
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "required Saas UI starter receipt is missing: docs/template/saas-ui-starter-files.json",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing upstream license notices", () => {
    const root = createFixture();
    try {
      rmSync(join(root, "docs/licenses/saas-ui/pro-NOTICE.md"));
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "missing paid source license notice: docs/licenses/saas-ui/pro-NOTICE.md",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires preserved notices to remain under the Saas UI license root", () => {
    const root = createFixture();
    try {
      const manifestPath = join(root, "docs/template/saas-ui-upstream.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        licenses: Array<{ destination: string }>;
      };
      const firstLicense = manifest.licenses[0];
      if (!firstLicense) throw new Error("fixture license is missing");
      manifest.licenses[0] = {
        ...firstLicense,
        destination: "docs/template/starter-NOTICE.md",
      };
      writeFileSync(manifestPath, JSON.stringify(manifest));
      writeFileSync(join(root, "docs/template/starter-NOTICE.md"), "notice\n");
      expect(assertSaasUiArtifactSafety(root)).toContain(
        "paid source license notice must remain under docs/licenses/saas-ui/: docs/template/starter-NOTICE.md",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
